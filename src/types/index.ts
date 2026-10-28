export type ID = string;
export type ISODate = string; // ISO 8601 timestamp

export interface College {
  id: ID;
  name: string;
  code: string; // short code shown in tables, e.g. "SACS"
  city: string;
}

export interface Team {
  id: ID;
  name: string;
  description: string;
}

/** Not a login: the admin records updates on their behalf. */
export interface FunctionalOwner {
  id: ID;
  name: string;
  email: string;
  teamId: ID;
  collegeId: ID;
}

interface UserBase {
  id: ID;
  fullName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: ISODate;
}

export interface Student extends UserBase {
  role: 'student';
  rollNumber: string;
  department: string;
  yearOfStudy: 1 | 2 | 3 | 4 | 5;
  collegeId: ID;
  mobile?: string;
  photo?: string; // data URL, resized to 256px before saving
}

export interface Admin extends UserBase {
  role: 'admin';
  title: string;
  collegeIds: ID[];
}

export type User = Student | Admin;
export type PublicStudent = Omit<Student, 'passwordHash' | 'passwordSalt'>;
export type PublicAdmin = Omit<Admin, 'passwordHash' | 'passwordSalt'>;
export type PublicUser = PublicStudent | PublicAdmin;

export const CATEGORIES = [
  'Examination',
  'Fees',
  'Placement',
  'Mentor',
  'Teaching Style',
  'Infrastructure',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = [
  'open',
  'under_review',
  'in_progress',
  'assigned',
  'awaiting_student',
  'resolved',
  'closed',
  'reopened',
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export interface Assignment {
  id: ID;
  teamId: ID;
  ownerId: ID;
  rationale: string; // required when routing or re-routing
  assignedBy: ID; // admin id
  assignedAt: ISODate;
  endedAt?: ISODate; // set when the ticket is re-routed, taken back by the manager, or resolved
}

export interface ActionItem {
  id: ID;
  text: string;
  responsible: string; // free text: an owner's name, "Campus manager", ...
  dueDate: string; // YYYY-MM-DD
  done: boolean;
  createdBy: ID;
  createdAt: ISODate;
  doneAt?: ISODate;
}

export type EventType =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'reassigned'
  | 'public_update'
  | 'internal_note'
  | 'clarification_requested'
  | 'student_reply'
  | 'action_added'
  | 'action_done'
  | 'action_reopened'
  | 'resolved'
  | 'closed'
  | 'reopened';

export interface TicketEvent {
  id: ID;
  ticketId: ID;
  type: EventType;
  at: ISODate;
  actor: { kind: 'student' | 'admin' | 'system'; id?: ID; name: string };
  onBehalfOf?: { ownerId: ID; name: string; team: string }; // an admin recording a functional owner's update
  visibility: 'public' | 'internal';
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  message?: string;
  meta?: Record<string, string>;
}

export interface Ticket {
  id: ID; // human-readable, e.g. TKT-2026-000123
  studentId: ID;
  collegeId: ID;
  category: Category;
  customCategory?: string; // required when category is "Other"
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  currentAssignment: Assignment | null; // null = with the campus manager
  assignments: Assignment[]; // every routing, newest last
  actionItems: ActionItem[];
  resolutionNote?: string;
  resolvedAt?: ISODate;
  closedAt?: ISODate;
  closedBy?: 'admin' | 'system';
  reopenCount: number;
}

export interface EmailMessage {
  id: ID;
  to: string[];
  subject: string;
  body: string;
  sentAt: ISODate;
  ticketId?: ID;
  template:
    | 'ticket_submitted'
    | 'ticket_closed'
    | 'ticket_routed'
    | 'clarification_requested'
    | 'ticket_reopened';
  collegeId?: ID;
}
export interface Department {
  id: ID;
  collegeId: ID;
  name: string;
  code: string; // used in subject codes, e.g. "CS"
}

/** level 1 = first semester of the year, level 2 = second. */
export interface Subject {
  id: ID;
  departmentId: ID;
  code: string;
  name: string;
  teacher: string;
  credits: number;
  level: 1 | 2;
}

export interface Enrollment {
  studentId: ID;
  subjectId: ID;
  semester: number;
  current: boolean;
}

export type ExamType = 'Internal 1' | 'Internal 2' | 'Semester End';

export interface Result {
  id: ID;
  studentId: ID;
  subjectId: ID;
  semester: number;
  examType: ExamType;
  marks: number;
  maxMarks: number;
  grade: string;
  gradePoint: number;
  publishedAt: ISODate;
}

export interface Attendance {
  studentId: ID;
  subjectId: ID;
  totalClasses: number;
  attended: number;
  updatedAt: ISODate;
}

export interface TimetableSlot {
  id: ID;
  subjectId: ID;
  day: 1 | 2 | 3 | 4 | 5 | 6; // Monday..Saturday
  start: string; // HH:MM
  end: string;
  room: string;
}

export interface Notice {
  id: ID;
  collegeId: ID;
  authorId: ID;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Database {
  version: number;
  colleges: College[];
  teams: Team[];
  owners: FunctionalOwner[];
  users: User[];
  tickets: Ticket[];
  events: TicketEvent[];
  emails: EmailMessage[];
  departments: Department[];
  subjects: Subject[];
  enrollments: Enrollment[];
  results: Result[];
  attendance: Attendance[];
  timetable: TimetableSlot[];
  notices: Notice[];
  counters: { ticket: number };
  session: { userId: ID; issuedAt: ISODate } | null;
}
