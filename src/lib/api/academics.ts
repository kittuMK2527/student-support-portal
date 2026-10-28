import type { Database, Department, Notice, Result, Student, User } from '@/types';
import { ApiError, forbidden, notFound } from './errors';
import { newId } from './crypto';
import { nowIso } from './clock';
import { byId } from '@/lib/db/lookup';

export function gradeFor(pct: number): [string, number] {
  if (pct >= 90) return ['O', 10];
  if (pct >= 80) return ['A+', 9];
  if (pct >= 70) return ['A', 8];
  if (pct >= 60) return ['B+', 7];
  if (pct >= 50) return ['B', 6];
  if (pct >= 40) return ['C', 5];
  return ['F', 0];
}
export const currentSemester = (year: number) => year * 2 - 1;
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const REQUIRED_ATTENDANCE = 75;

function requireStudent(u: User): Student {
  if (u.role !== 'student') throw forbidden('Only students can do this');
  return u;
}
function requireAdmin(u: User) {
  if (u.role !== 'admin') throw forbidden('Only campus managers can do this');
  return u;
}

export function departmentFor(
  db: Database,
  collegeId: string,
  value: string,
): Department | undefined {
  const v = value.trim().toLowerCase();
  return db.departments.find(
    (d) => d.collegeId === collegeId && (d.id === value || d.name.toLowerCase() === v),
  );
}

// Year Y is semester 2Y-1: level 1 in year 1, otherwise level 2 with level 1 as the previous semester.
export function enrollStudent(db: Database, s: Student) {
  const dept = departmentFor(db, s.collegeId, s.department);
  if (!dept) return;
  const sem = currentSemester(s.yearOfStudy);
  const level = (l: 1 | 2) =>
    db.subjects.filter((x) => x.departmentId === dept.id && x.level === l);
  const current = sem === 1 ? level(1) : level(2);
  for (const sub of current)
    db.enrollments.push({ studentId: s.id, subjectId: sub.id, semester: sem, current: true });
  if (sem > 1)
    for (const sub of level(1))
      db.enrollments.push({
        studentId: s.id,
        subjectId: sub.id,
        semester: sem - 1,
        current: false,
      });
}
export function resultsFor(db: Database, studentId: string) {
  const subject = (id: string) => byId(db.subjects, id, 'subject');
  const rows = db.results.filter((r) => r.studentId === studentId);
  const order: Record<string, number> = { 'Semester End': 3, 'Internal 2': 2, 'Internal 1': 1 };
  const bySem = new Map<number, Map<string, Result[]>>();
  for (const r of rows) {
    let m = bySem.get(r.semester);
    if (!m) bySem.set(r.semester, (m = new Map()));
    m.set(r.examType, [...(m.get(r.examType) ?? []), r]);
  }
  let cgNum = 0,
    cgDen = 0;
  const semesters = [...bySem.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([semester, exams]) => ({
      semester,
      exams: [...exams.entries()]
        .sort((a, b) => order[b[0]] - order[a[0]])
        .map(([examType, list]) => {
          const subjects = list
            .map((r) => ({
              code: subject(r.subjectId).code,
              name: subject(r.subjectId).name,
              credits: subject(r.subjectId).credits,
              marks: r.marks,
              maxMarks: r.maxMarks,
              grade: r.grade,
              gradePoint: r.gradePoint,
            }))
            .sort((a, b) => a.code.localeCompare(b.code));
          const marks = subjects.reduce((a, x) => a + x.marks, 0),
            max = subjects.reduce((a, x) => a + x.maxMarks, 0);
          const out = {
            examType,
            publishedAt: list[0].publishedAt,
            subjects,
            totalMarks: marks,
            totalMax: max,
            percentage: round((marks / max) * 100),
            failed: subjects.filter((x) => x.grade === 'F').length,
            sgpa: null as number | null,
            credits: 0,
          };
          if (examType === 'Semester End') {
            const num = subjects.reduce((a, x) => a + x.credits * x.gradePoint, 0),
              den = subjects.reduce((a, x) => a + x.credits, 0);
            out.sgpa = round(num / den);
            out.credits = den;
            cgNum += num;
            cgDen += den;
          }
          return out;
        }),
    }));
  return { semesters, cgpa: cgDen ? round(cgNum / cgDen) : null, creditsCompleted: cgDen };
}
export type StudentResults = ReturnType<typeof resultsFor>;

function attendanceFor(db: Database, studentId: string) {
  const rows = db.attendance
    .filter((a) => a.studentId === studentId)
    .map((a) => {
      const sub = byId(db.subjects, a.subjectId, 'subject');
      return {
        code: sub.code,
        name: sub.name,
        teacher: sub.teacher,
        total: a.totalClasses,
        attended: a.attended,
        percentage: a.totalClasses ? round((a.attended / a.totalClasses) * 100, 1) : null,
        updatedAt: a.updatedAt,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  const at = rows.reduce((s, r) => s + r.attended, 0),
    tt = rows.reduce((s, r) => s + r.total, 0);
  return {
    subjects: rows,
    overall: { attended: at, total: tt, percentage: tt ? round((at / tt) * 100, 1) : null },
    required: REQUIRED_ATTENDANCE,
  };
}
export function studentHome(db: Database, u: User) {
  const s = requireStudent(u);
  const current = db.enrollments.filter((e) => e.studentId === s.id && e.current);
  const credits = current.reduce(
    (a, e) => a + (db.subjects.find((x) => x.id === e.subjectId)?.credits ?? 0),
    0,
  );
  const results = resultsFor(db, s.id);
  const latestSem = results.semesters[0],
    latest = latestSem?.exams[0];
  const tickets = db.tickets.filter((t) => t.studentId === s.id);
  const att = attendanceFor(db, s.id);
  return {
    semester: currentSemester(s.yearOfStudy),
    subjects: { count: current.length, credits },
    attendance: att.overall,
    latestResult: latest
      ? {
          semester: latestSem.semester,
          examType: latest.examType,
          percentage: latest.percentage,
          publishedAt: latest.publishedAt,
        }
      : null,
    cgpa: results.cgpa,
    tickets: {
      open: tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length,
      total: tickets.length,
      awaitingYou: tickets.filter((t) => t.status === 'awaiting_student').length,
    },
    notices: listNotices(db, s.collegeId).slice(0, 3),
  };
}

export function studentSubjects(db: Database, u: User) {
  const s = requireStudent(u);
  return db.enrollments
    .filter((e) => e.studentId === s.id)
    .map((e) => {
      const sub = byId(db.subjects, e.subjectId, 'subject');
      return {
        id: sub.id,
        code: sub.code,
        name: sub.name,
        teacher: sub.teacher,
        credits: sub.credits,
        semester: e.semester,
        current: e.current,
      };
    })
    .sort((a, b) => b.semester - a.semester || a.code.localeCompare(b.code));
}

export const studentResults = (db: Database, u: User) => resultsFor(db, requireStudent(u).id);
export const studentAttendance = (db: Database, u: User) => attendanceFor(db, requireStudent(u).id);

export function studentTimetable(db: Database, u: User) {
  const s = requireStudent(u);
  const current = new Set(
    db.enrollments.filter((e) => e.studentId === s.id && e.current).map((e) => e.subjectId),
  );
  return db.timetable
    .filter((t) => current.has(t.subjectId))
    .map((t) => {
      const sub = byId(db.subjects, t.subjectId, 'subject');
      return { ...t, code: sub.code, name: sub.name, teacher: sub.teacher };
    })
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

export function listNotices(db: Database, collegeId: string) {
  return db.notices
    .filter((n) => n.collegeId === collegeId)
    .map((n) => ({
      ...n,
      authorName: db.users.find((u) => u.id === n.authorId)?.fullName ?? 'Campus office',
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}
export const studentNotices = (db: Database, u: User) =>
  listNotices(db, requireStudent(u).collegeId);

export function updateProfile(
  _db: Database,
  u: User,
  input: { fullName?: string; mobile?: string; photo?: string | null },
) {
  const s = requireStudent(u);
  const f: Record<string, string> = {};
  if (input.fullName !== undefined && input.fullName.trim().length < 2)
    f.fullName = 'Enter your full name';
  if (
    input.mobile !== undefined &&
    input.mobile !== '' &&
    !/^[6-9]\d{9}$/.test(input.mobile.trim())
  )
    f.mobile = 'Enter a valid 10-digit mobile number';
  if (
    input.photo &&
    (!/^data:image\/(jpeg|png|webp);base64,/.test(input.photo) || input.photo.length > 400_000)
  )
    f.photo = 'Use a JPG, PNG or WEBP image';
  if (Object.keys(f).length) throw new ApiError(400, 'Please correct the highlighted fields', f);
  if (input.fullName !== undefined) s.fullName = input.fullName.trim();
  if (input.mobile !== undefined) s.mobile = input.mobile.trim() || undefined;
  if (input.photo !== undefined) s.photo = input.photo || undefined;
}
export function adminStudents(db: Database, u: User, q: { q?: string; collegeId?: string } = {}) {
  const a = requireAdmin(u);
  const needle = q.q?.trim().toLowerCase();
  return db.users
    .filter(
      (x): x is Student =>
        x.role === 'student' &&
        a.collegeIds.includes(x.collegeId) &&
        (!q.collegeId || x.collegeId === q.collegeId),
    )
    .filter(
      (s) =>
        !needle ||
        [s.fullName, s.rollNumber, s.email, s.department].some((v) =>
          v.toLowerCase().includes(needle),
        ),
    )
    .map((s) => {
      const att = attendanceFor(db, s.id).overall;
      const tickets = db.tickets.filter((t) => t.studentId === s.id);
      return {
        id: s.id,
        fullName: s.fullName,
        rollNumber: s.rollNumber,
        email: s.email,
        mobile: s.mobile,
        photo: s.photo,
        department: s.department,
        yearOfStudy: s.yearOfStudy,
        college: byId(db.colleges, s.collegeId, 'college').code,
        attendance: att.percentage,
        cgpa: resultsFor(db, s.id).cgpa,
        openTickets: tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length,
        totalTickets: tickets.length,
      };
    })
    .sort((x, y) => x.college.localeCompare(y.college) || x.rollNumber.localeCompare(y.rollNumber));
}

export function adminNotices(db: Database, u: User) {
  const a = requireAdmin(u);
  return a.collegeIds
    .flatMap((c) => listNotices(db, c))
    .sort((x, y) => Number(y.pinned) - Number(x.pinned) || y.createdAt.localeCompare(x.createdAt));
}

function checkNotice(input: { title: string; body: string }) {
  const f: Record<string, string> = {};
  if ((input.title ?? '').trim().length < 3) f.title = 'Title: at least 3 characters';
  if ((input.title ?? '').trim().length > 120) f.title = 'Title: at most 120 characters';
  if ((input.body ?? '').trim().length < 10) f.body = 'Notice: at least 10 characters';
  if (Object.keys(f).length) throw new ApiError(400, 'Please correct the highlighted fields', f);
}

export function adminCreateNotice(
  db: Database,
  u: User,
  input: { collegeId: string; title: string; body: string; pinned?: boolean },
) {
  const a = requireAdmin(u);
  if (!a.collegeIds.includes(input.collegeId))
    throw new ApiError(400, 'Choose one of your colleges', {
      collegeId: 'Choose one of your colleges',
    });
  checkNotice(input);
  const n: Notice = {
    id: newId('ntc'),
    collegeId: input.collegeId,
    authorId: a.id,
    title: input.title.trim(),
    body: input.body.trim(),
    pinned: !!input.pinned,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.notices.push(n);
  return n;
}

function adminNotice(db: Database, u: User, id: string) {
  const a = requireAdmin(u);
  const n = db.notices.find((x) => x.id === id);
  if (!n) throw notFound('Notice not found');
  if (!a.collegeIds.includes(n.collegeId))
    throw forbidden('This notice belongs to a college you do not manage');
  return n;
}
export function adminUpdateNotice(
  db: Database,
  u: User,
  id: string,
  input: { title: string; body: string; pinned?: boolean },
) {
  const n = adminNotice(db, u, id);
  checkNotice(input);
  n.title = input.title.trim();
  n.body = input.body.trim();
  n.pinned = !!input.pinned;
  n.updatedAt = nowIso();
  return n;
}
export function adminDeleteNotice(db: Database, u: User, id: string) {
  const n = adminNotice(db, u, id);
  db.notices = db.notices.filter((x) => x.id !== n.id);
  return true;
}
