// Stands in for HTTP: resolves the session user, runs one backend call at a time, persists, returns a copy.
import type { Database, PublicUser, TicketStatus, User } from '@/types';
import { readDb, writeDb, clearDb } from '@/lib/db/storage';
import { buildSeed, DEMO, SEED_STUDENT_IDS } from '@/lib/db/seed';
import { ApiError, unauthorized } from './errors';
import * as be from './backend';
import * as ac from './academics';
import { nowIso } from './clock';

const LATENCY_MS = import.meta.env?.MODE === 'test' ? 0 : 120;
let queue: Promise<unknown> = Promise.resolve();
let seeding: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  const db = readDb();
  if (db) return db;
  seeding ??= buildSeed().then((d) => {
    writeDb(d);
    seeding = null;
    return d;
  });
  return seeding;
}

function call<T>(fn: (db: Database) => T | Promise<T>, { write = true } = {}): Promise<T> {
  const run = async () => {
    if (LATENCY_MS) await new Promise((r) => setTimeout(r, LATENCY_MS));
    const db = await getDb();
    const swept = await be.sweepAutoClose(db);
    const out = await fn(db);
    if (write || swept) writeDb(db);
    return structuredClone(out);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

function sessionUser(db: Database): User {
  const id = db.session?.userId;
  const u = id && db.users.find((x) => x.id === id);
  if (!u) throw unauthorized();
  return u;
}
const as = <T>(fn: (db: Database, u: User) => T | Promise<T>, opts?: { write?: boolean }) =>
  call((db) => fn(db, sessionUser(db)), opts);

export const api = {
  auth: {
    me: () =>
      call(
        (db) => {
          const id = db.session?.userId;
          const u = id && db.users.find((x) => x.id === id);
          return u ? be.toPublic(u) : null;
        },
        { write: false },
      ),
    register: (input: be.RegisterInput) =>
      call(async (db) => {
        const s = await be.register(db, input);
        db.session = { userId: s.id, issuedAt: nowIso() };
        return s as PublicUser;
      }),
    login: (email: string, password: string) =>
      call(async (db) => {
        const u = await be.login(db, email, password);
        db.session = { userId: u.id, issuedAt: nowIso() };
        return be.toPublic(u);
      }),
    demoLogin: (role: 'student' | 'admin') =>
      call(async (db) => {
        const cred = role === 'student' ? DEMO.student : DEMO.admin;
        const u = await be.login(db, cred.email, cred.password);
        db.session = { userId: u.id, issuedAt: nowIso() };
        return be.toPublic(u);
      }),
    logout: () =>
      call((db) => {
        db.session = null;
        return true;
      }),
  },
  reference: () =>
    call(
      (db) => {
        const id = db.session?.userId;
        return be.reference(db, (id && db.users.find((x) => x.id === id)) || null);
      },
      { write: false },
    ),
  student: {
    home: () => as((db, u) => ac.studentHome(db, u), { write: false }),
    updateProfile: (input: { fullName?: string; mobile?: string; photo?: string | null }) =>
      as((db, u) => {
        ac.updateProfile(db, u, input);
        return be.toPublic(u);
      }),
    subjects: () => as((db, u) => ac.studentSubjects(db, u), { write: false }),
    results: () => as((db, u) => ac.studentResults(db, u), { write: false }),
    attendance: () => as((db, u) => ac.studentAttendance(db, u), { write: false }),
    timetable: () => as((db, u) => ac.studentTimetable(db, u), { write: false }),
    notices: () => as((db, u) => ac.studentNotices(db, u), { write: false }),
    list: (status?: TicketStatus) =>
      as((db, u) => be.listMyTickets(db, u, status), { write: false }),
    get: (id: string) => as((db, u) => be.getMyTicket(db, u, id), { write: false }),
    create: (input: be.CreateTicketInput) =>
      as((db, u) =>
        be
          .createTicket(db, u, input)
          .then((t) => ({ id: t.id, createdAt: t.createdAt, status: t.status })),
      ),
    reply: (id: string, message: string) => as((db, u) => be.studentReply(db, u, id, message)),
    reopen: (id: string, reason: string) => as((db, u) => be.studentReopen(db, u, id, reason)),
  },
  admin: {
    summary: (collegeId?: string) =>
      as((db, u) => be.adminSummary(db, u, collegeId), { write: false }),
    list: (q: be.AdminListQuery) => as((db, u) => be.adminList(db, u, q), { write: false }),
    get: (id: string) => as((db, u) => be.adminGet(db, u, id)), // writes: opening an Open ticket acknowledges it
    transition: (id: string, to: TicketStatus, note?: string) =>
      as((db, u) => be.adminTransition(db, u, id, to, note)),
    assign: (id: string, input: { teamId: string; ownerId: string; rationale: string }) =>
      as((db, u) => be.adminAssign(db, u, id, input)),
    addUpdate: (
      id: string,
      input: { message: string; visibility: 'public' | 'internal'; onBehalfOfOwnerId?: string },
    ) => as((db, u) => be.adminAddUpdate(db, u, id, input)),
    requestClarification: (id: string, message: string) =>
      as((db, u) => be.adminRequestClarification(db, u, id, message)),
    resolve: (id: string, note: string) => as((db, u) => be.adminResolve(db, u, id, note)),
    close: (id: string, note: string) => as((db, u) => be.adminClose(db, u, id, note)),
    addAction: (id: string, input: { text: string; responsible: string; dueDate: string }) =>
      as((db, u) => be.adminAddAction(db, u, id, input)),
    toggleAction: (id: string, itemId: string, done: boolean) =>
      as((db, u) => be.adminToggleAction(db, u, id, itemId, done)),
    students: (q: { q?: string; collegeId?: string } = {}) =>
      as((db, u) => ac.adminStudents(db, u, q), { write: false }),
    notices: () => as((db, u) => ac.adminNotices(db, u), { write: false }),
    createNotice: (input: { collegeId: string; title: string; body: string; pinned?: boolean }) =>
      as((db, u) => ac.adminCreateNotice(db, u, input)),
    updateNotice: (id: string, input: { title: string; body: string; pinned?: boolean }) =>
      as((db, u) => ac.adminUpdateNotice(db, u, id, input)),
    deleteNotice: (id: string) => as((db, u) => ac.adminDeleteNotice(db, u, id)),
    outbox: (ticketId?: string) => as((db, u) => be.adminOutbox(db, u, ticketId), { write: false }),
  },
  demo: {
    // demo panel only: yes/no flags, no personal data
    progress: () =>
      call(
        (db) => {
          const seeded = new Set(SEED_STUDENT_IDS);
          const newStudents = db.users
            .filter((u) => u.role === 'student' && !seeded.has(u.id))
            .map((u) => u.id);
          const t = [...db.tickets]
            .reverse()
            .find((x) => newStudents.includes(x.studentId) && x.category === 'Placement');
          const ev = t ? db.events.filter((e) => e.ticketId === t.id) : [];
          const mails = t ? db.emails.filter((m) => m.ticketId === t.id) : [];
          return {
            ticketId: t?.id ?? null,
            registered: newStudents.length > 0,
            submitted: !!t,
            managerEmailed: mails.some((m) => m.template === 'ticket_submitted'),
            assignedWithAction:
              !!t &&
              t.assignments.some((a) => a.teamId === 'team_placement') &&
              t.actionItems.length > 0,
            ownerProgress: ev.some((e) => !!e.onBehalfOf),
            closed: t?.status === 'closed',
            closureEmails: mails.filter((m) => m.template === 'ticket_closed').length >= 2,
          };
        },
        { write: false },
      ),
    reset: async () => {
      await queue.catch(() => {});
      clearDb();
      seeding = null;
      await getDb();
      return true;
    },
  },
};

export { ApiError };
export type { AdminRow, AdminTicketDetail, StudentTicket, AdminListQuery } from './backend';
export type { StudentResults } from './academics';
