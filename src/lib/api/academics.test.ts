import { beforeEach, describe, expect, it } from 'vitest';
import { api, ApiError } from './index';
import { DEMO } from '@/lib/db/seed';
import { gradeFor } from './academics';

const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an error');
};
beforeEach(async () => {
  await api.demo.reset();
});

describe('student dashboard', () => {
  it("home shows current subjects, latest result, CGPA, attendance, tickets and the college's notices", async () => {
    await api.auth.demoLogin('student'); // Priya: CS, year 4 -> semester 7
    const h = await api.student.home();
    expect(h.semester).toBe(7);
    expect(h.subjects).toEqual({ count: 5, credits: 18 });
    expect(h.latestResult?.examType).toBe('Internal 2');
    expect(h.cgpa).toBeGreaterThan(0);
    expect(h.cgpa).toBeLessThanOrEqual(10);
    expect(h.attendance.percentage).toBeGreaterThan(75);
    expect(h.tickets.total).toBe(3);
    expect(h.notices[0].pinned).toBe(true);
  });

  it("subjects: current semester + previous semester of the student's own department only", async () => {
    await api.auth.demoLogin('student');
    const subs = await api.student.subjects();
    expect(subs).toHaveLength(10);
    expect(
      subs.filter((s) => s.current).every((s) => s.semester === 7 && s.code.startsWith('CS2')),
    ).toBe(true);
    expect(
      subs.filter((s) => !s.current).every((s) => s.semester === 6 && s.code.startsWith('CS1')),
    ).toBe(true);
  });

  it('results: SGPA = credit-weighted grade points of the semester-end exam; CGPA over semesters; percentages', async () => {
    await api.auth.demoLogin('student');
    const r = await api.student.results();
    const end = r.semesters.find((s) => s.semester === 6)!.exams[0];
    expect(end.examType).toBe('Semester End');
    const expected =
      end.subjects.reduce((a, x) => a + x.credits * x.gradePoint, 0) /
      end.subjects.reduce((a, x) => a + x.credits, 0);
    expect(end.sgpa).toBe(Math.round(expected * 100) / 100);
    expect(r.cgpa).toBe(end.sgpa);
    const i2 = r.semesters[0].exams[0];
    expect(i2.examType).toBe('Internal 2');
    expect(i2.percentage).toBe(Math.round((i2.totalMarks / i2.totalMax) * 10000) / 100);
    expect(gradeFor(39)).toEqual(['F', 0]);
    expect(gradeFor(90)).toEqual(['O', 10]);
  });

  it('attendance per subject with the 75% rule; timetable has 20 classes a week with no clashes', async () => {
    await api.auth.login('divya.krishnan@student.demo', 'Student@123');
    const a = await api.student.attendance();
    expect(a.subjects).toHaveLength(5);
    expect(a.required).toBe(75);
    expect(a.overall.percentage).toBeLessThan(75); // Divya is below the requirement on purpose
    const t = await api.student.timetable();
    expect(t).toHaveLength(20);
    expect(new Set(t.map((x) => `${x.day}-${x.start}`)).size).toBe(20);
  });

  it("a newly registered student is enrolled in their department's subjects (no marks yet); year 1 has no previous semester", async () => {
    await api.auth.register({
      fullName: 'New Learner',
      rollNumber: 'GASC25MA001',
      department: 'Mathematics',
      yearOfStudy: 1,
      collegeId: 'col_gasc',
      email: 'new.learner@student.demo',
      password: 'Learn1234',
      confirmPassword: 'Learn1234',
    });
    const subs = await api.student.subjects();
    expect(subs).toHaveLength(5);
    expect(subs.every((s) => s.semester === 1 && s.code.startsWith('MA1'))).toBe(true);
    expect((await api.student.results()).semesters).toEqual([]);
    expect(await api.student.timetable()).toHaveLength(20);
    const h = await api.student.home();
    expect(h.latestResult).toBeNull();
    expect(h.cgpa).toBeNull();
    expect(h.notices.length).toBeGreaterThan(0);
  });

  it('profile: name, mobile and photo can change; email, roll number and college cannot', async () => {
    await api.auth.demoLogin('student');
    expect((await err(api.student.updateProfile({ mobile: '12345' }))).fields!.mobile).toBeTruthy();
    expect(
      (await err(api.student.updateProfile({ photo: 'data:text/html;base64,PHNjcmlwdD4=' })))
        .fields!.photo,
    ).toBeTruthy();
    const u = await api.student.updateProfile({
      fullName: 'Priya S. Sharma',
      mobile: '9876543210',
      photo: 'data:image/png;base64,iVBORw0KGgo=',
      email: 'x@y.z',
      rollNumber: 'HACK',
    } as never);
    expect(u.fullName).toBe('Priya S. Sharma');
    expect(u.role === 'student' && u.mobile).toBe('9876543210');
    expect(u.email).toBe(DEMO.student.email);
    expect(u.role === 'student' && u.rollNumber).toBe('RCE21CS014');
    expect(JSON.stringify(u)).not.toMatch(/password/i);
  });
});

describe('access rules', () => {
  it('students only get their own records; admins cannot use student endpoints', async () => {
    await api.auth.demoLogin('admin');
    expect((await err(api.student.results())).status).toBe(403);
    await api.auth.demoLogin('student');
    expect((await err(api.admin.students())).status).toBe(403);
    expect(
      (
        await err(
          api.admin.createNotice({
            collegeId: 'col_rce',
            title: 'Hi there',
            body: 'A notice from a student',
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("notices: an admin posts to their own college only; students see their college's notices only", async () => {
    await api.auth.demoLogin('admin'); // Anita, RCE
    expect(
      (
        await err(
          api.admin.createNotice({
            collegeId: 'col_lbs',
            title: 'Wrong college',
            body: 'This should not be allowed.',
          }),
        )
      ).status,
    ).toBe(400);
    const n = await api.admin.createNotice({
      collegeId: 'col_rce',
      title: 'Library closed Saturday',
      body: 'The central library is closed this Saturday for stock-taking.',
      pinned: true,
    });
    await api.auth.demoLogin('student');
    expect((await api.student.notices())[0].title).toBe('Library closed Saturday');
    await api.auth.login('kavya.iyer@student.demo', 'Student@123');
    expect((await api.student.notices()).some((x) => x.title === 'Library closed Saturday')).toBe(
      false,
    );
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    expect(
      (
        await err(
          api.admin.updateNotice(n.id, {
            title: 'Hacked title',
            body: 'Changed by another manager',
          }),
        )
      ).status,
    ).toBe(403);
    expect((await err(api.admin.deleteNotice(n.id))).status).toBe(403);
    await api.auth.demoLogin('admin');
    expect(
      (
        await api.admin.updateNotice(n.id, {
          title: 'Library closed on Saturday',
          body: n.body,
          pinned: false,
        })
      ).pinned,
    ).toBe(false);
    expect(await api.admin.deleteNotice(n.id)).toBe(true);
  });

  it("the students list is scoped to the admin's colleges, with attendance, CGPA and ticket counts", async () => {
    await api.auth.demoLogin('admin');
    const rce = await api.admin.students();
    expect(rce).toHaveLength(3);
    expect(rce.every((s) => s.college === 'RCE')).toBe(true);
    expect(rce.every((s) => s.attendance! > 0 && s.cgpa! > 0)).toBe(true);
    expect(JSON.stringify(rce)).not.toMatch(/password/i);
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    const both = await api.admin.students();
    expect(new Set(both.map((s) => s.college))).toEqual(new Set(['GASC', 'LBS']));
    expect(await api.admin.students({ q: 'LBS23MB009' })).toHaveLength(1);
  });
});

describe('saved data', () => {
  it('incomplete saved data (e.g. from an older version) is replaced by a fresh seed instead of breaking pages', async () => {
    const { readDb, writeDb } = await import('@/lib/db/storage');
    const db = readDb()!;
    const broken = { ...db } as Record<string, unknown>;
    delete broken.enrollments;
    writeDb(broken as never);
    const storage = await import('@/lib/db/storage');
    storage.clearDb(); // drop the in-memory copy, keep nothing: the next read must reseed
    await api.auth.demoLogin('student');
    expect((await api.student.subjects()).length).toBe(10);
  });
});
