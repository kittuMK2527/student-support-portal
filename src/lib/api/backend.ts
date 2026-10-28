import type {
  ActionItem,
  Admin,
  Assignment,
  Category,
  College,
  Database,
  FunctionalOwner,
  PublicStudent,
  PublicUser,
  Student,
  Team,
  Ticket,
  TicketEvent,
  TicketStatus,
  User,
} from '@/types';
import { CATEGORIES } from '@/types';
import { ApiError, forbidden, notFound } from './errors';
import { hashPassword, newId, newSalt, verifyPassword } from './crypto';
import { now, nowIso } from './clock';
import {
  assertTransition,
  isOverdue,
  nextActions,
  REOPEN_WINDOW_DAYS,
  STATUS_LABEL,
  TransitionError,
} from '@/lib/workflow/transitions';
import { emailService } from '@/lib/email/service';
import * as tpl from '@/lib/email/templates';
import { byId } from '@/lib/db/lookup';
import { departmentFor, enrollStudent } from './academics';
export const toPublic = (u: User): PublicUser => {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest as PublicUser;
};
const college = (db: Database, id: string): College => byId(db.colleges, id, 'college');
const team = (db: Database, id: string): Team => byId(db.teams, id, 'team');
const owner = (db: Database, id: string): FunctionalOwner => byId(db.owners, id, 'owner');
const studentOf = (db: Database, t: Ticket): Student =>
  db.users.find((u) => u.id === t.studentId) as Student;
const managersOf = (db: Database, collegeId: string): Admin[] =>
  db.users.filter((u): u is Admin => u.role === 'admin' && u.collegeIds.includes(collegeId));
const actorOf = (u: User): TicketEvent['actor'] => ({ kind: u.role, id: u.id, name: u.fullName });
const SYSTEM: TicketEvent['actor'] = { kind: 'system', name: 'System' };
const wrap = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof TransitionError) throw new ApiError(409, e.message);
    throw e;
  }
};

function logEvent(
  db: Database,
  ticket: Ticket,
  e: Omit<TicketEvent, 'id' | 'ticketId' | 'at'>,
): TicketEvent {
  const ev: TicketEvent = { id: newId('evt'), ticketId: ticket.id, at: nowIso(), ...e };
  db.events.push(ev);
  ticket.updatedAt = ev.at;
  return ev;
}

function setStatus(
  db: Database,
  t: Ticket,
  to: TicketStatus,
  actor: TicketEvent['actor'],
  message?: string,
  visibility: 'public' | 'internal' = 'public',
) {
  const from = t.status;
  t.status = to;
  logEvent(db, t, {
    type: 'status_changed',
    actor,
    visibility,
    fromStatus: from,
    toStatus: to,
    message,
  });
}

function requireStudent(u: User): Student {
  if (u.role !== 'student') throw forbidden('Only students can do this');
  return u;
}
function requireAdmin(u: User): Admin {
  if (u.role !== 'admin') throw forbidden('Only campus managers can do this');
  return u;
}
function adminTicket(db: Database, a: Admin, id: string): Ticket {
  const t = db.tickets.find((x) => x.id === id);
  if (!t) throw notFound('Ticket not found');
  if (!a.collegeIds.includes(t.collegeId))
    throw forbidden('This ticket belongs to a college you do not manage');
  return t;
}
// 404 rather than 403, so students can't probe for other tickets
function studentTicket(db: Database, s: Student, id: string): Ticket {
  const t = db.tickets.find((x) => x.id === id);
  if (!t || t.studentId !== s.id) throw notFound('Ticket not found');
  return t;
}
export interface RegisterInput {
  fullName: string;
  rollNumber: string;
  department: string;
  yearOfStudy: number;
  collegeId: string;
  email: string;
  password: string;
  confirmPassword: string;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateRegistration(db: Database, input: RegisterInput): Record<string, string> {
  const f: Record<string, string> = {};
  const req = (k: keyof RegisterInput, label: string) => {
    if (!String(input[k] ?? '').trim()) f[k] = `${label} is required`;
  };
  req('fullName', 'Full name');
  req('rollNumber', 'Roll number');
  req('department', 'Department');
  req('collegeId', 'College');
  req('email', 'Email');
  if (!f.fullName && input.fullName.trim().length < 2) f.fullName = 'Enter your full name';
  if (!f.rollNumber && !/^[A-Za-z0-9/-]{3,20}$/.test(input.rollNumber.trim()))
    f.rollNumber = 'Use 3-20 letters, digits, / or -';
  if (
    !Number.isInteger(Number(input.yearOfStudy)) ||
    Number(input.yearOfStudy) < 1 ||
    Number(input.yearOfStudy) > 5
  )
    f.yearOfStudy = 'Choose a year from 1 to 5';
  if (!f.collegeId && !db.colleges.some((c) => c.id === input.collegeId))
    f.collegeId = 'Choose your college';
  if (!f.department && !f.collegeId && !departmentFor(db, input.collegeId, input.department))
    f.department = 'Choose a department of your college';
  if (!f.email && !EMAIL_RE.test(input.email.trim())) f.email = 'Enter a valid email address';
  if (!input.password) f.password = 'Password is required';
  else if (
    input.password.length < 8 ||
    !/[A-Za-z]/.test(input.password) ||
    !/\d/.test(input.password)
  )
    f.password = 'At least 8 characters, with a letter and a number';
  if (input.confirmPassword !== input.password) f.confirmPassword = 'Passwords do not match';
  const email = input.email.trim().toLowerCase();
  if (!f.email && db.users.some((u) => u.email.toLowerCase() === email))
    f.email = 'An account with this email already exists';
  const roll = input.rollNumber.trim().toUpperCase();
  if (
    !f.rollNumber &&
    !f.collegeId &&
    db.users.some(
      (u) =>
        u.role === 'student' &&
        u.collegeId === input.collegeId &&
        u.rollNumber.toUpperCase() === roll,
    )
  ) {
    f.rollNumber = 'This roll number is already registered at this college';
  }
  return f;
}

export async function register(db: Database, input: RegisterInput): Promise<PublicStudent> {
  const fields = validateRegistration(db, input);
  if (Object.keys(fields).length)
    throw new ApiError(400, 'Please correct the highlighted fields', fields);
  const dept = departmentFor(db, input.collegeId, input.department);
  if (!dept)
    throw new ApiError(400, 'Please correct the highlighted fields', {
      department: 'Choose a department of your college',
    });
  const salt = newSalt();
  const s: Student = {
    id: newId('stu'),
    role: 'student',
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    passwordSalt: salt,
    passwordHash: await hashPassword(input.password, salt),
    createdAt: nowIso(),
    rollNumber: input.rollNumber.trim().toUpperCase(),
    department: dept.name,
    yearOfStudy: Number(input.yearOfStudy) as Student['yearOfStudy'],
    collegeId: input.collegeId,
  };
  db.users.push(s);
  enrollStudent(db, s);
  return toPublic(s) as PublicStudent;
}

export async function login(db: Database, email: string, password: string): Promise<User> {
  const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  const ok = u ? await verifyPassword(password, u.passwordSalt, u.passwordHash) : false;
  if (!u || !ok) throw new ApiError(401, 'Incorrect email or password');
  return u;
}
export function reference(db: Database, u: User | null) {
  const colleges = db.colleges;
  const departments = db.departments;
  if (!u || u.role === 'student')
    return { colleges, departments, teams: db.teams, owners: [] as FunctionalOwner[] };
  return {
    colleges,
    departments,
    teams: db.teams,
    owners: db.owners.filter((o) => u.collegeIds.includes(o.collegeId)),
  };
}
export async function sweepAutoClose(db: Database): Promise<number> {
  let n = 0;
  for (const t of db.tickets) {
    if (t.status !== 'resolved' || !t.resolvedAt) continue;
    if ((now().getTime() - new Date(t.resolvedAt).getTime()) / 864e5 <= REOPEN_WINDOW_DAYS)
      continue;
    assertTransition('resolved', 'closed', 'system', { resolutionNote: t.resolutionNote });
    t.closedAt = nowIso();
    t.closedBy = 'system';
    setStatus(
      db,
      t,
      'closed',
      SYSTEM,
      `Closed automatically: no reopen within ${REOPEN_WINDOW_DAYS} days of resolution`,
    );
    logEvent(db, t, {
      type: 'closed',
      actor: SYSTEM,
      visibility: 'public',
      message: t.resolutionNote,
    });
    await sendClosureEmails(db, t);
    n++;
  }
  return n;
}

async function sendClosureEmails(db: Database, t: Ticket) {
  const s = studentOf(db, t);
  const st = tpl.ticketClosed(t, 'student', s);
  await emailService().send(
    { to: [s.email], ...st, ticketId: t.id, template: 'ticket_closed', collegeId: t.collegeId },
    db,
  );
  const mt = tpl.ticketClosed(t, 'manager', s);
  await emailService().send(
    {
      to: managersOf(db, t.collegeId).map((m) => m.email),
      ...mt,
      ticketId: t.id,
      template: 'ticket_closed',
      collegeId: t.collegeId,
    },
    db,
  );
}
export interface CreateTicketInput {
  category: string;
  customCategory?: string;
  subject: string;
  description: string;
}

export async function createTicket(
  db: Database,
  u: User,
  input: CreateTicketInput,
): Promise<Ticket> {
  const s = requireStudent(u);
  const f: Record<string, string> = {};
  if (!CATEGORIES.includes(input.category as Category)) f.category = 'Choose a category';
  if (input.category === 'Other' && !(input.customCategory ?? '').trim())
    f.customCategory = 'Say what this is about';
  if ((input.customCategory ?? '').trim().length > 40) f.customCategory = 'At most 40 characters';
  if (!input.subject?.trim()) f.subject = 'Subject is required';
  else if (input.subject.trim().length > 100) f.subject = 'At most 100 characters';
  if ((input.description ?? '').trim().length < 20)
    f.description = 'Describe the issue in at least 20 characters';
  if (Object.keys(f).length) throw new ApiError(400, 'Please correct the highlighted fields', f);

  db.counters.ticket += 1;
  const at = nowIso();
  const t: Ticket = {
    id: `TKT-${now().getFullYear()}-${String(db.counters.ticket).padStart(6, '0')}`,
    studentId: s.id,
    collegeId: s.collegeId,
    category: input.category as Category,
    customCategory: input.category === 'Other' ? (input.customCategory ?? '').trim() : undefined,
    subject: input.subject.trim(),
    description: input.description.trim(),
    status: 'open',
    createdAt: at,
    updatedAt: at,
    currentAssignment: null,
    assignments: [],
    actionItems: [],
    reopenCount: 0,
  };
  db.tickets.push(t);
  logEvent(db, t, {
    type: 'created',
    actor: actorOf(s),
    visibility: 'public',
    toStatus: 'open',
    message: 'Ticket submitted',
  });
  const c = college(db, t.collegeId);
  const m = tpl.ticketSubmitted(t, s, c);
  await emailService().send(
    {
      to: managersOf(db, t.collegeId).map((a) => a.email),
      ...m,
      ticketId: t.id,
      template: 'ticket_submitted',
      collegeId: t.collegeId,
    },
    db,
  );
  return t;
}

// No internal notes, action plan or owner contact details.
export function studentView(db: Database, t: Ticket) {
  const a = t.currentAssignment;
  return {
    id: t.id,
    category: t.category,
    customCategory: t.customCategory,
    subject: t.subject,
    description: t.description,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    closedBy: t.closedBy,
    resolutionNote: ['resolved', 'closed'].includes(t.status) ? t.resolutionNote : undefined,
    assignedTeam: a
      ? team(db, a.teamId).name
      : ['in_progress'].includes(t.status)
        ? 'Campus manager'
        : null,
    reopenDeadline:
      t.status === 'resolved' && t.resolvedAt
        ? new Date(new Date(t.resolvedAt).getTime() + REOPEN_WINDOW_DAYS * 864e5).toISOString()
        : undefined,
    timeline: db.events
      .filter((e) => e.ticketId === t.id && e.visibility === 'public')
      .map(({ id, type, at, actor, fromStatus, toStatus, message, onBehalfOf }) => ({
        id,
        type,
        at,
        fromStatus,
        toStatus,
        message,
        actorLabel:
          actor.kind === 'student'
            ? 'You'
            : actor.kind === 'system'
              ? 'System'
              : onBehalfOf
                ? `${onBehalfOf.team} team`
                : 'Campus manager',
      })),
    canReply: t.status === 'awaiting_student',
    canReopen:
      nextActions(t.status, 'student').some((x) => x.to === 'reopened') &&
      !!t.resolvedAt &&
      (now().getTime() - new Date(t.resolvedAt).getTime()) / 864e5 <= REOPEN_WINDOW_DAYS,
  };
}
export type StudentTicket = ReturnType<typeof studentView>;

export function listMyTickets(db: Database, u: User, status?: TicketStatus) {
  const s = requireStudent(u);
  return db.tickets
    .filter((t) => t.studentId === s.id && (!status || t.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => studentView(db, t));
}

export function getMyTicket(db: Database, u: User, id: string) {
  return studentView(db, studentTicket(db, requireStudent(u), id));
}

export async function studentReply(db: Database, u: User, id: string, message: string) {
  const s = requireStudent(u);
  const t = studentTicket(db, s, id);
  if (t.status !== 'awaiting_student')
    throw new ApiError(
      409,
      'You can reply when the campus manager has asked you for more information.',
    );
  if (message.trim().length < 2)
    throw new ApiError(400, 'Write a reply', { message: 'Write a reply' });
  logEvent(db, t, {
    type: 'student_reply',
    actor: actorOf(s),
    visibility: 'public',
    message: message.trim(),
  });
  wrap(() => assertTransition('awaiting_student', 'under_review', 'system'));
  setStatus(db, t, 'under_review', SYSTEM, 'The student replied; back with the campus manager');
  return studentView(db, t);
}

export async function studentReopen(db: Database, u: User, id: string, reason: string) {
  const s = requireStudent(u);
  const t = studentTicket(db, s, id);
  wrap(() =>
    assertTransition(t.status, 'reopened', 'student', {
      reason,
      resolvedAt: t.resolvedAt,
      now: now(),
    }),
  );
  t.reopenCount += 1;
  t.resolvedAt = undefined;
  setStatus(db, t, 'reopened', actorOf(s), reason.trim());
  logEvent(db, t, {
    type: 'reopened',
    actor: actorOf(s),
    visibility: 'public',
    message: reason.trim(),
  });
  const m = tpl.ticketReopened(t, s, reason.trim());
  await emailService().send(
    {
      to: managersOf(db, t.collegeId).map((a) => a.email),
      ...m,
      ticketId: t.id,
      template: 'ticket_reopened',
      collegeId: t.collegeId,
    },
    db,
  );
  return studentView(db, t);
}
export interface AdminListQuery {
  q?: string;
  status?: TicketStatus | 'overdue';
  category?: Category;
  collegeId?: string;
  teamId?: string;
  ownerId?: string;
  from?: string;
  to?: string;
  sort?: 'id' | 'student' | 'college' | 'category' | 'createdAt' | 'owner' | 'status';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function adminRow(db: Database, t: Ticket) {
  const s = studentOf(db, t),
    c = college(db, t.collegeId),
    a = t.currentAssignment;
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    customCategory: t.customCategory,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    student: { id: s.id, name: s.fullName, rollNumber: s.rollNumber },
    college: { id: c.id, code: c.code, name: c.name },
    owner: a
      ? {
          id: a.ownerId,
          name: owner(db, a.ownerId).name,
          team: team(db, a.teamId).name,
          teamId: a.teamId,
        }
      : null,
    overdue: isOverdue(t, now()),
  };
}
export type AdminRow = ReturnType<typeof adminRow>;

export function adminList(db: Database, u: User, q: AdminListQuery = {}) {
  const a = requireAdmin(u);
  const needle = q.q?.trim().toLowerCase();
  let rows = db.tickets
    .filter((t) => a.collegeIds.includes(t.collegeId))
    .map((t) => adminRow(db, t));
  if (q.collegeId) rows = rows.filter((r) => r.college.id === q.collegeId);
  if (q.status === 'overdue') rows = rows.filter((r) => r.overdue);
  else if (q.status) rows = rows.filter((r) => r.status === q.status);
  if (q.category) rows = rows.filter((r) => r.category === q.category);
  if (q.teamId) rows = rows.filter((r) => r.owner?.teamId === q.teamId);
  if (q.ownerId) rows = rows.filter((r) => r.owner?.id === q.ownerId);
  const { from, to } = q;
  if (from) rows = rows.filter((r) => r.createdAt.slice(0, 10) >= from);
  if (to) rows = rows.filter((r) => r.createdAt.slice(0, 10) <= to);
  if (needle)
    rows = rows.filter((r) =>
      [r.id, r.student.name, r.student.rollNumber, r.subject].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  const key = q.sort ?? 'createdAt',
    dir = q.dir ?? (key === 'createdAt' ? 'desc' : 'asc');
  const val = (r: AdminRow): string =>
    ({
      id: r.id,
      student: r.student.name,
      college: r.college.code,
      category: r.category,
      createdAt: r.createdAt,
      owner: r.owner?.name ?? '',
      status: STATUS_LABEL[r.status],
    })[key];
  rows.sort(
    (x, y) =>
      (dir === 'asc' ? 1 : -1) * val(x).localeCompare(val(y)) ||
      y.createdAt.localeCompare(x.createdAt),
  );
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 10)),
    page = Math.max(1, q.page ?? 1);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export function adminSummary(db: Database, u: User, collegeId?: string) {
  const a = requireAdmin(u);
  const ts = db.tickets.filter(
    (t) => a.collegeIds.includes(t.collegeId) && (!collegeId || t.collegeId === collegeId),
  );
  const count = (s: TicketStatus) => ts.filter((t) => t.status === s).length;
  return {
    open: count('open') + count('reopened'),
    reopened: count('reopened'),
    underReview: count('under_review'),
    inProgress: count('in_progress') + count('assigned'),
    assigned: count('assigned'),
    awaitingStudent: count('awaiting_student'),
    resolved: count('resolved'),
    closed: count('closed'),
    overdue: ts.filter((t) => isOverdue(t, now())).length,
    total: ts.length,
  };
}

// Opening an Open ticket acknowledges it.
export function adminGet(db: Database, u: User, id: string) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  if (t.status === 'open') {
    wrap(() => assertTransition('open', 'under_review', 'admin'));
    setStatus(db, t, 'under_review', actorOf(a), `Acknowledged by ${a.fullName}`);
  }
  const s = studentOf(db, t);
  return {
    ticket: t,
    student: toPublic(s) as PublicStudent,
    college: college(db, t.collegeId),
    events: db.events.filter((e) => e.ticketId === t.id).sort((x, y) => x.at.localeCompare(y.at)),
    assignments: t.assignments.map((x) => ({
      ...x,
      ownerName: owner(db, x.ownerId).name,
      ownerEmail: owner(db, x.ownerId).email,
      teamName: team(db, x.teamId).name,
    })),
    nextActions: nextActions(t.status, 'admin'),
    overdue: isOverdue(t, now()),
  };
}
export type AdminTicketDetail = ReturnType<typeof adminGet>;
export async function adminTransition(
  db: Database,
  u: User,
  id: string,
  to: TicketStatus,
  note?: string,
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  if (to === 'assigned')
    throw new ApiError(
      400,
      'Use "Assign to a team" to route a ticket (team, owner and rationale are required).',
    );
  if (to === 'resolved') throw new ApiError(400, 'Use "Mark resolved" with a resolution note.');
  if (to === 'closed') throw new ApiError(400, 'Use "Close ticket" with a resolution note.');
  if (to === 'awaiting_student')
    throw new ApiError(400, 'Use "Request clarification" with your question for the student.');
  wrap(() => assertTransition(t.status, to, 'admin'));
  if (to === 'in_progress' && t.currentAssignment) {
    t.currentAssignment.endedAt = nowIso();
    t.currentAssignment = null;
  }
  setStatus(
    db,
    t,
    to,
    actorOf(a),
    note?.trim() ||
      (to === 'in_progress' ? 'The campus manager is handling this ticket' : undefined),
  );
}

export async function adminAssign(
  db: Database,
  u: User,
  id: string,
  input: { teamId: string; ownerId: string; rationale: string },
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  const fields: Record<string, string> = {};
  if (!db.teams.some((x) => x.id === input.teamId)) fields.teamId = 'Choose a team';
  const o = db.owners.find((x) => x.id === input.ownerId);
  if (!o) fields.ownerId = 'Choose an owner';
  else if (o.teamId !== input.teamId) fields.ownerId = 'This person is not in the chosen team';
  else if (o.collegeId !== t.collegeId)
    fields.ownerId = "Choose an owner from the ticket's college";
  if ((input.rationale ?? '').trim().length < 10)
    fields.rationale = 'Explain why (at least 10 characters)';
  if (!o || Object.keys(fields).length)
    throw new ApiError(400, 'Please correct the highlighted fields', fields);
  if (t.currentAssignment?.ownerId === input.ownerId && t.status === 'assigned')
    throw new ApiError(409, `${o.name} already owns this ticket.`);
  wrap(() => assertTransition(t.status, 'assigned', 'admin', { assignment: input }));
  const reassigned = !!t.currentAssignment;
  const previous = t.currentAssignment;
  if (previous) previous.endedAt = nowIso();
  const asg: Assignment = {
    id: newId('asg'),
    teamId: input.teamId,
    ownerId: input.ownerId,
    rationale: input.rationale.trim(),
    assignedBy: a.id,
    assignedAt: nowIso(),
  };
  t.assignments.push(asg);
  t.currentAssignment = asg;
  const tm = team(db, input.teamId);
  logEvent(db, t, {
    type: reassigned ? 'reassigned' : 'assigned',
    actor: actorOf(a),
    visibility: 'internal',
    message: asg.rationale,
    meta: {
      team: tm.name,
      owner: o.name,
      ...(previous
        ? {
            previousOwner: owner(db, previous.ownerId).name,
            previousTeam: team(db, previous.teamId).name,
          }
        : {}),
    },
  });
  if (t.status !== 'assigned')
    setStatus(db, t, 'assigned', actorOf(a), `Routed to the ${tm.name} team`);
  else
    logEvent(db, t, {
      type: 'public_update',
      actor: actorOf(a),
      visibility: 'public',
      message: `Your ticket is now with the ${tm.name} team.`,
    });
  const s = studentOf(db, t);
  const m = tpl.ticketRouted(
    t,
    o,
    tm.name,
    asg.rationale,
    a.fullName,
    s,
    college(db, t.collegeId),
    reassigned,
  );
  await emailService().send(
    { to: [o.email], ...m, ticketId: t.id, template: 'ticket_routed', collegeId: t.collegeId },
    db,
  );
}

export async function adminAddUpdate(
  db: Database,
  u: User,
  id: string,
  input: { message: string; visibility: 'public' | 'internal'; onBehalfOfOwnerId?: string },
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  if (t.status === 'closed') throw new ApiError(409, 'This ticket is closed.');
  if ((input.message ?? '').trim().length < 3)
    throw new ApiError(400, 'Write the update', { message: 'Write the update' });
  let onBehalfOf: TicketEvent['onBehalfOf'];
  if (input.onBehalfOfOwnerId) {
    const o = db.owners.find((x) => x.id === input.onBehalfOfOwnerId);
    if (!o || o.collegeId !== t.collegeId)
      throw new ApiError(400, "Choose an owner from this ticket's college");
    onBehalfOf = { ownerId: o.id, name: o.name, team: team(db, o.teamId).name };
  }
  logEvent(db, t, {
    type: input.visibility === 'public' ? 'public_update' : 'internal_note',
    actor: actorOf(a),
    visibility: input.visibility,
    message: input.message.trim(),
    onBehalfOf,
  });
}

export async function adminRequestClarification(
  db: Database,
  u: User,
  id: string,
  message: string,
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  wrap(() =>
    assertTransition(t.status, 'awaiting_student', 'admin', { clarificationMessage: message }),
  );
  logEvent(db, t, {
    type: 'clarification_requested',
    actor: actorOf(a),
    visibility: 'public',
    message: message.trim(),
  });
  setStatus(db, t, 'awaiting_student', actorOf(a));
  const s = studentOf(db, t);
  const m = tpl.clarificationRequested(t, s, message.trim());
  await emailService().send(
    {
      to: [s.email],
      ...m,
      ticketId: t.id,
      template: 'clarification_requested',
      collegeId: t.collegeId,
    },
    db,
  );
}

export async function adminResolve(db: Database, u: User, id: string, resolutionNote: string) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  wrap(() => assertTransition(t.status, 'resolved', 'admin', { resolutionNote }));
  t.resolutionNote = resolutionNote.trim();
  t.resolvedAt = nowIso();
  setStatus(
    db,
    t,
    'resolved',
    actorOf(a),
    `You can reopen this within ${REOPEN_WINDOW_DAYS} days if the problem is not solved.`,
  );
  logEvent(db, t, {
    type: 'resolved',
    actor: actorOf(a),
    visibility: 'public',
    message: t.resolutionNote,
  });
}

export async function adminClose(db: Database, u: User, id: string, resolutionNote: string) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  wrap(() => assertTransition(t.status, 'closed', 'admin', { resolutionNote }));
  t.resolutionNote = resolutionNote.trim();
  t.closedAt = nowIso();
  t.closedBy = 'admin';
  if (t.currentAssignment) t.currentAssignment.endedAt = t.closedAt;
  setStatus(db, t, 'closed', actorOf(a));
  logEvent(db, t, {
    type: 'closed',
    actor: actorOf(a),
    visibility: 'public',
    message: t.resolutionNote,
  });
  await sendClosureEmails(db, t);
}

export async function adminAddAction(
  db: Database,
  u: User,
  id: string,
  input: { text: string; responsible: string; dueDate: string },
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  if (t.status === 'closed') throw new ApiError(409, 'This ticket is closed.');
  const f: Record<string, string> = {};
  if ((input.text ?? '').trim().length < 3) f.text = 'Describe the action';
  if (!(input.responsible ?? '').trim()) f.responsible = 'Who is responsible?';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? '')) f.dueDate = 'Pick a due date';
  if (Object.keys(f).length) throw new ApiError(400, 'Please correct the highlighted fields', f);
  const item: ActionItem = {
    id: newId('act'),
    text: input.text.trim(),
    responsible: input.responsible.trim(),
    dueDate: input.dueDate,
    done: false,
    createdBy: a.id,
    createdAt: nowIso(),
  };
  t.actionItems.push(item);
  logEvent(db, t, {
    type: 'action_added',
    actor: actorOf(a),
    visibility: 'internal',
    message: item.text,
    meta: { responsible: item.responsible, due: item.dueDate },
  });
  return item;
}

export async function adminToggleAction(
  db: Database,
  u: User,
  id: string,
  itemId: string,
  done: boolean,
) {
  const a = requireAdmin(u);
  const t = adminTicket(db, a, id);
  const item = t.actionItems.find((x) => x.id === itemId);
  if (!item) throw notFound('Action item not found');
  if (item.done === done) return item;
  item.done = done;
  item.doneAt = done ? nowIso() : undefined;
  logEvent(db, t, {
    type: done ? 'action_done' : 'action_reopened',
    actor: actorOf(a),
    visibility: 'internal',
    message: item.text,
  });
  return item;
}

export function adminOutbox(db: Database, u: User, ticketId?: string) {
  const a = requireAdmin(u);
  return db.emails
    .filter(
      (m) =>
        (!m.collegeId || a.collegeIds.includes(m.collegeId)) &&
        (!ticketId || m.ticketId === ticketId),
    )
    .sort((x, y) => y.sentAt.localeCompare(x.sentAt));
}
