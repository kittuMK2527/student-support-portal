import { beforeEach, describe, expect, it } from 'vitest';
import { api, ApiError } from './index';
import { DEMO } from '@/lib/db/seed';
import { setClock } from './clock';

const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an error');
};
const reg = {
  fullName: 'Neha Joshi',
  rollNumber: 'RCE22CS099',
  department: 'dep_rce_cs',
  yearOfStudy: 3,
  collegeId: 'col_rce',
  email: 'neha.joshi@student.demo',
  password: 'Neha12345',
  confirmPassword: 'Neha12345',
};

beforeEach(async () => {
  setClock(null);
  await api.demo.reset();
});

describe('seed data', () => {
  it('has 3 colleges, 8 students, 20 tickets covering every status and category', async () => {
    await api.auth.demoLogin('admin');
    const ref = await api.reference();
    expect(ref.colleges).toHaveLength(3);
    const a = await api.admin.list({ pageSize: 100 });
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    const b = await api.admin.list({ pageSize: 100 });
    const all = [...a.rows, ...b.rows];
    expect(all).toHaveLength(20);
    expect(new Set(all.map((r) => r.status))).toEqual(
      new Set([
        'open',
        'under_review',
        'in_progress',
        'assigned',
        'awaiting_student',
        'resolved',
        'closed',
        'reopened',
      ]),
    );
    expect(new Set(all.map((r) => r.category)).size).toBe(7);
    expect(new Set(all.map((r) => r.student.id)).size).toBe(8);
    expect(all.some((r) => r.overdue)).toBe(true);
  });
});

describe('access rules in the data layer', () => {
  it('a student only ever gets their own tickets; another student\'s ticket is "not found"', async () => {
    await api.auth.demoLogin('student');
    const mine = await api.student.list();
    expect(mine.length).toBeGreaterThan(0);
    await api.auth.demoLogin('admin');
    const others = (await api.admin.list({ pageSize: 100 })).rows.filter(
      (r) => r.student.name !== 'Priya Sharma',
    );
    await api.auth.demoLogin('student');
    expect((await err(api.student.get(others[0].id))).status).toBe(404);
    expect(mine.some((t) => others.some((o) => o.id === t.id))).toBe(false);
  });

  it('students never receive internal notes, action plans, owner names or emails', async () => {
    await api.auth.demoLogin('student');
    const t = (await api.student.list()).find((x) => x.status === 'assigned')!;
    const json = JSON.stringify(await api.student.get(t.id));
    expect(json).not.toMatch(/internal|actionItems|Karthik|@rce\.demo|passwordHash|passwordSalt/);
    expect(JSON.parse(json).assignedTeam).toBe('Placement');
  });

  it('a student cannot use admin functions, and an admin only sees their own colleges', async () => {
    await api.auth.demoLogin('student');
    expect((await err(api.admin.list({}))).status).toBe(403);
    await api.auth.demoLogin('admin'); // Anita: RCE only
    const rows = (await api.admin.list({ pageSize: 100 })).rows;
    expect(rows.every((r) => r.college.code === 'RCE')).toBe(true);
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    const lbs = (await api.admin.list({ pageSize: 100 })).rows[0];
    await api.auth.demoLogin('admin');
    expect((await err(api.admin.get(lbs.id))).status).toBe(403);
    expect(
      (
        await err(
          api.admin.assign(lbs.id, {
            teamId: 'team_finance',
            ownerId: 'own_lbs_finance',
            rationale: 'trying across colleges',
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('logged-out calls are refused', async () => {
    await api.auth.logout();
    expect((await err(api.student.list())).status).toBe(401);
    expect((await err(api.admin.summary())).status).toBe(401);
  });
});

describe('registration and login', () => {
  it('validates every field and shows inline errors', async () => {
    const e = await err(
      api.auth.register({
        fullName: '',
        rollNumber: '!',
        department: '',
        yearOfStudy: 7,
        collegeId: '',
        email: 'bad',
        password: 'short',
        confirmPassword: 'x',
      }),
    );
    expect(e.status).toBe(400);
    expect(Object.keys(e.fields!).sort()).toEqual([
      'collegeId',
      'confirmPassword',
      'department',
      'email',
      'fullName',
      'password',
      'rollNumber',
      'yearOfStudy',
    ]);
    expect(
      (
        await err(
          api.auth.register({ ...reg, password: 'lettersonly', confirmPassword: 'lettersonly' }),
        )
      ).fields!.password,
    ).toMatch(/letter and a number/);
  });

  it('email is unique; roll number is unique per college (allowed at another college)', async () => {
    expect(
      (await err(api.auth.register({ ...reg, email: DEMO.student.email.toUpperCase() }))).fields!
        .email,
    ).toMatch(/already exists/);
    expect(
      (await err(api.auth.register({ ...reg, rollNumber: 'rce21cs014' }))).fields!.rollNumber,
    ).toMatch(/already registered/);
    expect(
      (
        await err(
          api.auth.register({
            ...reg,
            email: 'x1@student.demo',
            rollNumber: 'RCE21CS014',
            collegeId: 'col_gasc',
          }),
        )
      ).fields!.department,
    ).toMatch(/department of your college/);
    const ok = await api.auth.register({
      ...reg,
      rollNumber: 'RCE21CS014',
      collegeId: 'col_gasc',
      department: 'dep_gasc_bc',
    });
    expect(ok.role).toBe('student');
    expect(JSON.stringify(ok)).not.toMatch(/password/i);
  });

  it('wrong credentials give one clear error', async () => {
    expect((await err(api.auth.login(DEMO.student.email, 'nope12345'))).message).toBe(
      'Incorrect email or password',
    );
    expect((await err(api.auth.login('nobody@x.com', 'nope12345'))).message).toBe(
      'Incorrect email or password',
    );
  });
});

describe('ticket creation', () => {
  it('validates category, subject, description and the custom label for "Other"', async () => {
    await api.auth.demoLogin('student');
    const e = await err(
      api.student.create({ category: 'Other', subject: 'x'.repeat(101), description: 'too short' }),
    );
    expect(Object.keys(e.fields!).sort()).toEqual(['customCategory', 'description', 'subject']);
  });

  it('gives TKT-YYYY-000123 IDs, status Open, and the college comes from the student, not the request', async () => {
    await api.auth.demoLogin('student');
    const t = await api.student.create({
      category: 'Fees',
      subject: 'Bus pass fee',
      description: 'The bus pass fee was charged although I opted out.',
      collegeId: 'col_lbs',
    } as never);
    expect(t.id).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(t.status).toBe('open');
    await api.auth.demoLogin('admin');
    expect((await api.admin.get(t.id)).college.code).toBe('RCE');
  });
});

describe('the guided demo scenario', () => {
  it('register -> Placement ticket -> manager email -> assign with action -> owner progress -> resolve -> close -> closure emails', async () => {
    const s = await api.auth.register(reg);
    const t = await api.student.create({
      category: 'Placement',
      subject: 'Offer letter not received from TCS',
      description:
        'I was selected in the TCS drive on 10 October but have not received my offer letter yet.',
    });
    await api.auth.demoLogin('admin');
    let mails = await api.admin.outbox(t.id);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual([DEMO.admin.email]);
    expect(mails[0].body).toContain(t.id);
    expect(mails[0].body).toContain('RCE22CS099');
    expect(mails[0].body).toContain('Placement');
    const d = await api.admin.get(t.id);
    expect(d.ticket.status).toBe('under_review');
    expect(d.nextActions.map((x) => x.to)).toEqual(['in_progress', 'assigned', 'awaiting_student']);
    expect(
      (
        await err(
          api.admin.assign(t.id, {
            teamId: 'team_placement',
            ownerId: 'own_rce_placement',
            rationale: '',
          }),
        )
      ).fields!.rationale,
    ).toBeTruthy();
    await api.admin.assign(t.id, {
      teamId: 'team_placement',
      ownerId: 'own_rce_placement',
      rationale: 'Offer letters are handled by the placement cell.',
    });
    await api.admin.addAction(t.id, {
      text: 'Call TCS campus HR about the offer letter',
      responsible: 'Karthik Raman',
      dueDate: '2026-11-02',
    });
    mails = await api.admin.outbox(t.id);
    expect(
      mails.some((m) => m.template === 'ticket_routed' && m.to[0].startsWith('karthik.raman')),
    ).toBe(true);
    await api.admin.addUpdate(t.id, {
      message: 'TCS HR confirmed the letter will be emailed by Friday.',
      visibility: 'public',
      onBehalfOfOwnerId: 'own_rce_placement',
    });
    await api.admin.addUpdate(t.id, {
      message: 'Karthik to escalate if not sent by Friday.',
      visibility: 'internal',
    });
    expect(
      (await err(api.admin.close(t.id, 'Offer letter has been received by the student.'))).message,
    ).toMatch(/Assigned to Team cannot move to Closed/);
    expect((await err(api.admin.resolve(t.id, 'done'))).message).toMatch(/at least 20/);
    await api.admin.resolve(
      t.id,
      'TCS has emailed the offer letter; a copy is with the placement cell.',
    );
    await api.admin.close(
      t.id,
      'TCS has emailed the offer letter; a copy is with the placement cell.',
    );
    mails = (await api.admin.outbox(t.id)).filter((m) => m.template === 'ticket_closed');
    expect(
      mails
        .map((m) => m.to)
        .flat()
        .sort(),
    ).toEqual([DEMO.admin.email, s.email].sort());
    expect(mails[0].body).toMatch(/Resolution summary/);
    const log = (await api.admin.get(t.id)).events.map((e) => e.type);
    expect(log).toEqual([
      'created',
      'status_changed',
      'assigned',
      'status_changed',
      'action_added',
      'public_update',
      'internal_note',
      'status_changed',
      'resolved',
      'status_changed',
      'closed',
    ]);
    await api.auth.login(reg.email, reg.password);
    const mine = await api.student.get(t.id);
    expect(mine.status).toBe('closed');
    expect(mine.resolutionNote).toMatch(/offer letter/);
    expect(mine.timeline.some((e) => e.actorLabel === 'Placement team')).toBe(true);
    expect(JSON.stringify(mine)).not.toMatch(/escalate|Call TCS/);
  });
});

describe('clarification, reopen and auto-close', () => {
  it('a student reply moves Awaiting Student back to Under Review; replies are only allowed then', async () => {
    await api.auth.demoLogin('student');
    const t = await api.student.create({
      category: 'Mentor',
      subject: 'Need a mentor meeting',
      description: 'I need to discuss my project topic with my mentor urgently.',
    });
    expect((await err(api.student.reply(t.id, 'hello'))).status).toBe(409);
    await api.auth.demoLogin('admin');
    await api.admin.get(t.id);
    await api.admin.requestClarification(t.id, 'Which project and which mentor do you mean?');
    await api.auth.demoLogin('student');
    expect((await api.student.get(t.id)).canReply).toBe(true);
    expect(
      (await api.student.reply(t.id, 'The final year project; my mentor is Dr. Rao.')).status,
    ).toBe('under_review');
  });

  it('reopen needs a reason and is only possible within 7 days; after 7 days the ticket closes itself and both are emailed', async () => {
    await api.auth.demoLogin('student');
    const t = await api.student.create({
      category: 'Infrastructure',
      subject: 'Broken chair',
      description: 'The chair at desk 12 in the library is broken and unsafe.',
    });
    await api.auth.demoLogin('admin');
    await api.admin.get(t.id);
    await api.admin.transition(t.id, 'in_progress');
    await api.admin.resolve(t.id, 'The chair at desk 12 has been replaced with a new one.');
    await api.auth.demoLogin('student');
    expect((await err(api.student.reopen(t.id, 'no'))).message).toMatch(/reason/);
    setClock(new Date(Date.now() + 8 * 864e5)); // 8 days later
    const after = await api.student.get(t.id); // the sweep runs on every call
    expect(after.status).toBe('closed');
    expect(after.closedBy).toBe('system');
    expect((await err(api.student.reopen(t.id, 'it broke again yesterday'))).status).toBe(409);
    await api.auth.demoLogin('admin');
    expect(
      (await api.admin.outbox(t.id)).filter((m) => m.template === 'ticket_closed'),
    ).toHaveLength(2);
  });

  it('a reopened ticket goes back to review; disallowed moves are blocked with a clear message', async () => {
    await api.auth.demoLogin('admin');
    const reopened = (await api.admin.list({ status: 'reopened' })).rows[0];
    expect((await err(api.admin.transition(reopened.id, 'in_progress'))).message).toMatch(
      /Reopened cannot move to In Progress/,
    );
    await api.admin.transition(reopened.id, 'under_review');
    expect((await api.admin.get(reopened.id)).ticket.status).toBe('under_review');
  });
});

describe('admin list', () => {
  it('searches, filters, sorts and paginates', async () => {
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    const all = await api.admin.list({ pageSize: 100 });
    expect(new Set(all.rows.map((r) => r.college.code))).toEqual(new Set(['GASC', 'LBS']));
    expect(
      (await api.admin.list({ collegeId: 'col_lbs', pageSize: 100 })).rows.every(
        (r) => r.college.code === 'LBS',
      ),
    ).toBe(true);
    expect(
      (await api.admin.list({ q: 'GASC21MA011' })).rows.every(
        (r) => r.student.rollNumber === 'GASC21MA011',
      ),
    ).toBe(true);
    expect(
      (await api.admin.list({ teamId: 'team_placement', pageSize: 100 })).rows.every(
        (r) => r.owner?.team === 'Placement',
      ),
    ).toBe(true);
    const byStudent = (
      await api.admin.list({ sort: 'student', dir: 'asc', pageSize: 100 })
    ).rows.map((r) => r.student.name);
    expect(byStudent).toEqual([...byStudent].sort((a, b) => a.localeCompare(b)));
    const p2 = await api.admin.list({ page: 2, pageSize: 5 });
    expect(p2.rows).toHaveLength(Math.min(5, all.total - 5));
    expect(p2.total).toBe(all.total);
    const s = await api.admin.summary();
    expect(s.total).toBe(all.total);
    expect(s.overdue).toBe((await api.admin.list({ status: 'overdue', pageSize: 100 })).total);
  });

  it('reassignment keeps the history of previous owners', async () => {
    await api.auth.login(DEMO.admin2.email, DEMO.admin2.password);
    const t = (await api.admin.list({ q: 'Internship certificate' })).rows[0];
    const d = await api.admin.get(t.id);
    expect(d.assignments.map((x) => x.teamName)).toEqual(['Academics', 'Placement']);
    expect(d.assignments[0].endedAt).toBeTruthy();
    expect(
      d.events.some((e) => e.type === 'reassigned' && e.meta?.previousTeam === 'Academics'),
    ).toBe(true);
  });
});
