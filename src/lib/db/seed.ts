// Ticket histories are created through the real backend functions with the clock moved back,
// so the audit log and emails match what the app produces.
import type {
  Admin,
  College,
  Database,
  FunctionalOwner,
  Result,
  Student,
  Team,
  User,
} from '@/types';
import { hashPassword, newSalt } from '@/lib/api/crypto';
import { daysAgo, setClock } from '@/lib/api/clock';
import * as be from '@/lib/api/backend';
import { DB_VERSION } from './storage';
import { byId } from './lookup';
import { CURRICULUM } from './curriculum';
import { enrollStudent, gradeFor } from '@/lib/api/academics';
import type { Department, Subject, TimetableSlot } from '@/types';

export const SEED_STUDENT_IDS = [
  'stu_saimanikanta',
  'stu_arjun',
  'stu_divya',
  'stu_rahul',
  'stu_sneha',
  'stu_mohammed',
  'stu_kavya',
  'stu_aditya',
];

export const DEMO = {
  student: { email: 'saimanikanta@student.demo', password: 'Student@123' },
  admin: { email: 'face.admin@rce.demo', password: 'Admin@1234' },
  admin2: { email: 'rahul.menon@ops.demo', password: 'Admin@1234' },
};

const COLLEGES: College[] = [
  { id: 'col_rce', name: 'Riverside College of Engineering', code: 'RCE', city: 'Chennai' },
  { id: 'col_gasc', name: 'Greenvale Arts & Science College', code: 'GASC', city: 'Coimbatore' },
  { id: 'col_lbs', name: 'Lakeview Business School', code: 'LBS', city: 'Bengaluru' },
];
const TEAMS: Team[] = [
  {
    id: 'team_placement',
    name: 'Placement',
    description: 'Internships, campus drives, offer letters',
  },
  { id: 'team_finance', name: 'Finance', description: 'Fees, refunds, scholarships, receipts' },
  {
    id: 'team_academics',
    name: 'Academics',
    description: 'Teaching, mentors, timetable, course issues',
  },
  {
    id: 'team_exams',
    name: 'Examination Cell',
    description: 'Exams, marks, revaluation, hall tickets',
  },
  {
    id: 'team_operations',
    name: 'Operations',
    description: 'Buildings, labs, Wi-Fi, transport, hostel',
  },
  {
    id: 'team_sales',
    name: 'Sales & Admissions',
    description: 'Admissions, programme changes, counselling',
  },
  {
    id: 'team_mentoring',
    name: 'Student Mentoring',
    description: 'Mentor allocation and wellbeing',
  },
];
const OWNER_NAMES: Record<string, string[]> = {
  team_placement: ['Karthik Raman', 'Sneha Pillai', 'Imran Shaikh'],
  team_finance: ['Lakshmi Iyer', 'Deepak Gupta', 'Farah Khan'],
  team_academics: ['Dr. Suresh Babu', 'Dr. Meera Nair', 'Prof. Arvind Rao'],
  team_exams: ['Ramesh Kumar', 'Kavitha S', 'Joseph Mathew'],
  team_operations: ['Vijay Anand', 'Prakash Reddy', 'Nisha Thomas'],
  team_sales: ['Ananya Bose', 'Rohit Malhotra', 'Pooja Hegde'],
  team_mentoring: ['Dr. Leela George', 'Dr. Sanjay Verma', 'Dr. Asha Menon'],
};

async function user<T extends User>(
  u: Omit<T, 'passwordHash' | 'passwordSalt' | 'createdAt'>,
  password: string,
  createdAt: string,
): Promise<T> {
  const salt = newSalt();
  return {
    ...u,
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    createdAt,
  } as T;
}

export async function buildSeed(base = new Date()): Promise<Database> {
  const at = (d: number) => daysAgo(d, base).toISOString();
  const owners: FunctionalOwner[] = [];
  COLLEGES.forEach((c, ci) =>
    TEAMS.forEach((t) => {
      const name = OWNER_NAMES[t.id][ci];
      owners.push({
        id: `own_${c.code.toLowerCase()}_${t.id.slice(5)}`,
        name,
        teamId: t.id,
        collegeId: c.id,
        email: `${name
          .toLowerCase()
          .replace(/^(dr|prof)\.\s*/, '')
          .replace(/[^a-z]+/g, '.')
          .replace(/\.$/, '')}@${c.code.toLowerCase()}.demo`,
      });
    }),
  );

  const admins: Admin[] = [
    await user<Admin>(
      {
        id: 'adm_face',
        role: 'admin',
        fullName: 'FACE Admin',
        email: DEMO.admin.email,
        title: 'Campus Manager, RCE',
        collegeIds: ['col_rce'],
      },
      DEMO.admin.password,
      at(200),
    ),
    await user<Admin>(
      {
        id: 'adm_rahul',
        role: 'admin',
        fullName: 'Rahul Menon',
        email: DEMO.admin2.email,
        title: 'Operations Manager, GASC & LBS',
        collegeIds: ['col_gasc', 'col_lbs'],
      },
      DEMO.admin2.password,
      at(200),
    ),
  ];
  const S = (
    id: string,
    fullName: string,
    email: string,
    rollNumber: string,
    department: string,
    yearOfStudy: Student['yearOfStudy'],
    collegeId: string,
  ) =>
    user<Student>(
      { id, role: 'student', fullName, email, rollNumber, department, yearOfStudy, collegeId },
      'Student@123',
      at(120),
    );
  const students: Student[] = [
    await S(
      'stu_saimanikanta',
      'Saimanikanta',
      DEMO.student.email,
      'RCE21CS014',
      'Computer Science',
      4,
      'col_rce',
    ),
    await S(
      'stu_arjun',
      'Arjun Nair',
      'arjun.nair@student.demo',
      'RCE22ME031',
      'Mechanical',
      3,
      'col_rce',
    ),
    await S(
      'stu_divya',
      'Divya Krishnan',
      'divya.krishnan@student.demo',
      'RCE23EC007',
      'Electronics',
      2,
      'col_rce',
    ),
    await S(
      'stu_rahul',
      'Rahul Verma',
      'rahul.verma@student.demo',
      'GASC22BC019',
      'Commerce',
      3,
      'col_gasc',
    ),
    await S(
      'stu_sneha',
      'Sneha Reddy',
      'sneha.reddy@student.demo',
      'GASC23PS004',
      'Psychology',
      2,
      'col_gasc',
    ),
    await S(
      'stu_mohammed',
      'Mohammed Faiz',
      'mohammed.faiz@student.demo',
      'GASC21MA011',
      'Mathematics',
      4,
      'col_gasc',
    ),
    await S(
      'stu_kavya',
      'Kavya Iyer',
      'kavya.iyer@student.demo',
      'LBS24MB022',
      'MBA Finance',
      1,
      'col_lbs',
    ),
    await S(
      'stu_aditya',
      'Aditya Kulkarni',
      'aditya.kulkarni@student.demo',
      'LBS23MB009',
      'MBA Marketing',
      2,
      'col_lbs',
    ),
  ];

  const db: Database = {
    version: DB_VERSION,
    colleges: COLLEGES,
    teams: TEAMS,
    owners,
    users: [...admins, ...students],
    tickets: [],
    events: [],
    emails: [],
    counters: { ticket: 100 },
    session: null,
    departments: [],
    subjects: [],
    enrollments: [],
    results: [],
    attendance: [],
    timetable: [],
    notices: [],
  };
  seedAcademics(db, base);
  const U = (id: string) => byId(db.users, id, 'user');
  const own = (college: string, team: string) => `own_${college}_${team}`;
  const step = async (days: number, fn: () => Promise<unknown> | unknown) => {
    setClock(daysAgo(days, base));
    await fn();
  };

  type Plan = {
    s: string;
    d: number;
    category: string;
    subject: string;
    description: string;
    custom?: string;
    flow?: (id: string) => Promise<void>;
  };
  const face = U('adm_face'),
    rahul = U('adm_rahul');
  const plans: Plan[] = [
    {
      s: 'stu_arjun',
      d: 1,
      category: 'Infrastructure',
      subject: 'Workshop lathe No. 4 unsafe',
      description:
        'The guard on lathe No. 4 in the mechanical workshop is broken and the machine is still being used in labs.',
    },
    {
      s: 'stu_kavya',
      d: 0.2,
      category: 'Fees',
      subject: 'Scholarship not adjusted in fee demand',
      description:
        'My merit scholarship of 40,000 rupees is not reflected in the second-term fee demand note.',
    },
    {
      s: 'stu_mohammed',
      d: 7,
      category: 'Other',
      custom: 'ID card',
      subject: 'Lost student ID card replacement',
      description:
        'I lost my ID card last week and need a replacement before the library access check next Monday.',
    },
    {
      s: 'stu_divya',
      d: 2,
      category: 'Teaching Style',
      subject: 'Signals & Systems lectures too fast',
      description:
        'The Signals and Systems lectures move too fast and there are no worked examples; most of the class is lost.',
      flow: async (id) => {
        await step(1.5, () => be.adminGet(db, face, id));
      },
    },
    {
      s: 'stu_sneha',
      d: 3,
      category: 'Mentor',
      subject: 'Mentor not available for two weeks',
      description:
        'My assigned mentor has not responded to messages or attended the weekly slot for two weeks now.',
      flow: async (id) => {
        await step(2.5, () => be.adminGet(db, rahul, id));
        await step(2.4, () =>
          be.adminAddUpdate(db, rahul, id, {
            message: 'Checking the mentor roster with the department.',
            visibility: 'internal',
          }),
        );
      },
    },
    {
      s: 'stu_aditya',
      d: 9,
      category: 'Examination',
      subject: 'Hall ticket shows wrong elective',
      description:
        'My hall ticket lists Retail Management instead of Digital Marketing, which is the elective I registered for.',
      flow: async (id) => {
        await step(8, () => be.adminGet(db, rahul, id));
      },
    },
    {
      s: 'stu_saimanikanta',
      d: 4,
      category: 'Infrastructure',
      subject: 'Wi-Fi drops in the CS lab block',
      description:
        'The Wi-Fi in the second floor CS labs disconnects every few minutes, so online lab submissions keep failing.',
      flow: async (id) => {
        await step(3.8, () => be.adminGet(db, face, id));
        await step(3.7, () => be.adminTransition(db, face, id, 'in_progress'));
        await step(3.6, () =>
          be.adminAddAction(db, face, id, {
            text: 'Ask the IT vendor to check the access points',
            responsible: 'FACE Admin',
            dueDate: daysAgo(-1, base).toISOString().slice(0, 10),
          }),
        );
        await step(2, () =>
          be.adminAddUpdate(db, face, id, {
            message: 'The vendor is replacing two access points on Friday.',
            visibility: 'public',
          }),
        );
      },
    },
    {
      s: 'stu_rahul',
      d: 6,
      category: 'Fees',
      subject: 'Duplicate late fee charged',
      description:
        'A late fee of 500 rupees was charged twice on my account even though I paid the term fee on time.',
      flow: async (id) => {
        await step(5.5, () => be.adminGet(db, rahul, id));
        await step(5.4, () => be.adminTransition(db, rahul, id, 'in_progress'));
      },
    },
    {
      s: 'stu_saimanikanta',
      d: 5,
      category: 'Placement',
      subject: 'Offer letter from Infotech not received',
      description:
        'I was selected in the Infotech campus drive three weeks ago but the offer letter has still not reached me.',
      flow: async (id) => {
        await step(4.8, () => be.adminGet(db, face, id));
        await step(4.7, () =>
          be.adminAssign(db, face, id, {
            teamId: 'team_placement',
            ownerId: own('rce', 'placement'),
            rationale: 'Offer letters are tracked by the placement cell.',
          }),
        );
        await step(4.6, () =>
          be.adminAddAction(db, face, id, {
            text: 'Follow up with Infotech HR on the offer letter',
            responsible: 'Karthik Raman',
            dueDate: daysAgo(-2, base).toISOString().slice(0, 10),
          }),
        );
        await step(3, () =>
          be.adminAddUpdate(db, face, id, {
            message: 'Infotech HR has confirmed the letters are being issued this week.',
            visibility: 'public',
            onBehalfOfOwnerId: own('rce', 'placement'),
          }),
        );
      },
    },
    {
      s: 'stu_kavya',
      d: 8,
      category: 'Placement',
      subject: 'Internship certificate needed for credit',
      description:
        'I need the summer internship completion certificate countersigned by the placement office for my credits.',
      flow: async (id) => {
        await step(7.5, () => be.adminGet(db, rahul, id));
        await step(7.4, () =>
          be.adminAssign(db, rahul, id, {
            teamId: 'team_academics',
            ownerId: own('lbs', 'academics'),
            rationale: 'Credit transfer is decided by the academic office.',
          }),
        );
        await step(6, () =>
          be.adminAssign(db, rahul, id, {
            teamId: 'team_placement',
            ownerId: own('lbs', 'placement'),
            rationale: 'Academics confirmed the placement office must countersign first.',
          }),
        );
      },
    },
    {
      s: 'stu_arjun',
      d: 3,
      category: 'Examination',
      subject: 'Revaluation result pending',
      description:
        'I applied for revaluation of Thermodynamics a month ago and the result is still not published.',
      flow: async (id) => {
        await step(2.8, () => be.adminGet(db, face, id));
        await step(2.7, () =>
          be.adminAssign(db, face, id, {
            teamId: 'team_exams',
            ownerId: own('rce', 'exams'),
            rationale: 'Revaluation results come from the examination cell.',
          }),
        );
      },
    },
    {
      s: 'stu_divya',
      d: 2.5,
      category: 'Fees',
      subject: 'Refund for dropped hostel seat',
      description:
        'I vacated my hostel seat at the start of the term and was promised a refund of the deposit.',
      flow: async (id) => {
        await step(2.2, () => be.adminGet(db, face, id));
        await step(2.1, () =>
          be.adminRequestClarification(
            db,
            face,
            id,
            'Please share the date you vacated and your bank account details for the refund.',
          ),
        );
      },
    },
    {
      s: 'stu_aditya',
      d: 4,
      category: 'Other',
      custom: 'Club funding',
      subject: 'Marketing club event budget',
      description:
        'Our marketing club needs approval for the budget of the national fest event in February.',
      flow: async (id) => {
        await step(3.5, () => be.adminGet(db, rahul, id));
        await step(3.4, () =>
          be.adminRequestClarification(
            db,
            rahul,
            id,
            "Please attach the itemised budget and the faculty coordinator's name.",
          ),
        );
      },
    },
    {
      s: 'stu_saimanikanta',
      d: 10,
      category: 'Examination',
      subject: 'Internal marks missing for Compiler Design',
      description:
        'My Internal 2 marks for Compiler Design show as absent although I wrote the test.',
      flow: async (id) => {
        await step(9.5, () => be.adminGet(db, face, id));
        await step(9.4, () =>
          be.adminAssign(db, face, id, {
            teamId: 'team_exams',
            ownerId: own('rce', 'exams'),
            rationale: 'Marks entry is handled by the examination cell.',
          }),
        );
        await step(6, () =>
          be.adminAddUpdate(db, face, id, {
            message: 'Answer script found; marks were not uploaded. Correcting now.',
            visibility: 'public',
            onBehalfOfOwnerId: own('rce', 'exams'),
          }),
        );
        await step(2, () =>
          be.adminResolve(
            db,
            face,
            id,
            'Your Internal 2 marks (38/50) have been uploaded and now appear on the portal.',
          ),
        );
      },
    },
    {
      s: 'stu_sneha',
      d: 9,
      category: 'Infrastructure',
      subject: 'Library AC not working',
      description:
        'The air conditioning in the reading hall of the central library has not worked for a week.',
      flow: async (id) => {
        await step(8.5, () => be.adminGet(db, rahul, id));
        await step(8.4, () =>
          be.adminAssign(db, rahul, id, {
            teamId: 'team_operations',
            ownerId: own('gasc', 'operations'),
            rationale: 'Building maintenance is with operations.',
          }),
        );
        await step(5, () =>
          be.adminResolve(
            db,
            rahul,
            id,
            'The compressor was replaced and the reading hall AC is working again.',
          ),
        );
      },
    },
    {
      s: 'stu_arjun',
      d: 25,
      category: 'Fees',
      subject: 'Exam fee receipt not generated',
      description:
        'I paid the semester exam fee online but no receipt was generated and the portal still shows it as unpaid.',
      flow: async (id) => {
        await step(24, () => be.adminGet(db, face, id));
        await step(23.8, () =>
          be.adminAssign(db, face, id, {
            teamId: 'team_finance',
            ownerId: own('rce', 'finance'),
            rationale: 'Payment reconciliation is done by finance.',
          }),
        );
        await step(21, () =>
          be.adminResolve(
            db,
            face,
            id,
            'The payment was matched with the bank statement and the receipt has been emailed to you.',
          ),
        );
        await step(20, () =>
          be.adminClose(
            db,
            face,
            id,
            'The payment was matched with the bank statement and the receipt has been emailed to you.',
          ),
        );
      },
    },
    {
      s: 'stu_rahul',
      d: 30,
      category: 'Mentor',
      subject: 'Change of mentor request',
      description:
        'I would like to change my mentor to a faculty member from my own specialisation in commerce.',
      flow: async (id) => {
        await step(29, () => be.adminGet(db, rahul, id));
        await step(28.5, () =>
          be.adminAssign(db, rahul, id, {
            teamId: 'team_mentoring',
            ownerId: own('gasc', 'mentoring'),
            rationale: 'Mentor allocation is owned by the mentoring team.',
          }),
        );
        await step(20, () =>
          be.adminResolve(
            db,
            rahul,
            id,
            'Your mentor has been changed to Dr. Sanjay Verma from the commerce department.',
          ),
        );
        // left alone: auto-closed by the sweep below
      },
    },
    {
      s: 'stu_kavya',
      d: 40,
      category: 'Teaching Style',
      subject: 'Case studies outdated in Corporate Finance',
      description:
        'The Corporate Finance case studies are from 2008 and do not reflect current markets; please update them.',
      flow: async (id) => {
        await step(39, () => be.adminGet(db, rahul, id));
        await step(38, () => be.adminTransition(db, rahul, id, 'in_progress'));
        await step(30, () =>
          be.adminResolve(
            db,
            rahul,
            id,
            'The faculty has added three recent case studies (2023-2025) to the course pack.',
          ),
        );
        await step(29, () =>
          be.adminClose(
            db,
            rahul,
            id,
            'The faculty has added three recent case studies (2023-2025) to the course pack.',
          ),
        );
      },
    },
    {
      s: 'stu_mohammed',
      d: 12,
      category: 'Placement',
      subject: 'Not shortlisted despite meeting criteria',
      description:
        'I meet the 7.5 CGPA cut-off for the Analytics Corp drive but my name is not on the shortlist.',
      flow: async (id) => {
        await step(11, () => be.adminGet(db, rahul, id));
        await step(10.8, () =>
          be.adminAssign(db, rahul, id, {
            teamId: 'team_placement',
            ownerId: own('gasc', 'placement'),
            rationale: 'Shortlists are prepared by the placement cell.',
          }),
        );
        await step(5, () =>
          be.adminResolve(
            db,
            rahul,
            id,
            'Your profile was re-checked and forwarded to Analytics Corp as an additional nomination.',
          ),
        );
        await step(2, () =>
          be.studentReopen(
            db,
            U('stu_mohammed'),
            id,
            'Analytics Corp says they never received my profile.',
          ),
        );
      },
    },
    {
      s: 'stu_divya',
      d: 15,
      category: 'Teaching Style',
      subject: 'Lab sessions cancelled repeatedly',
      description:
        'Our Digital Electronics lab sessions have been cancelled four times this month without a make-up session.',
      flow: async (id) => {
        await step(14, () => be.adminGet(db, face, id));
        await step(13.5, () =>
          be.adminAssign(db, face, id, {
            teamId: 'team_academics',
            ownerId: own('rce', 'academics'),
            rationale: 'Lab scheduling is decided by the academic office.',
          }),
        );
        await step(6, () =>
          be.adminResolve(
            db,
            face,
            id,
            'Two make-up lab sessions have been scheduled on Saturdays.',
          ),
        );
        await step(3, () =>
          be.studentReopen(
            db,
            U('stu_divya'),
            id,
            'Only one make-up session happened; the second was cancelled again.',
          ),
        );
      },
    },
  ];

  for (const p of plans) {
    let id = '';
    await step(p.d, async () => {
      id = (
        await be.createTicket(db, U(p.s), {
          category: p.category,
          customCategory: p.custom,
          subject: p.subject,
          description: p.description,
        })
      ).id;
    });
    if (p.flow) await p.flow(id);
  }
  setClock(base);
  await be.sweepAutoClose(db); // closes the mentor ticket resolved 20 days ago
  setClock(null);
  db.session = null;
  return db;
}
// seeded PRNG so marks and attendance are the same on every reset
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PERIODS: [string, string][] = [
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['11:10', '12:00'],
  ['13:00', '13:50'],
  ['14:00', '14:50'],
];
// [ability, attendance %]; Divya is below 75% on purpose
const PROFILE: Record<string, [number, number]> = {
  stu_saimanikanta: [84, 92],
  stu_arjun: [62, 81],
  stu_divya: [71, 68],
  stu_rahul: [77, 88],
  stu_sneha: [88, 95],
  stu_mohammed: [58, 74],
  stu_kavya: [91, 97],
  stu_aditya: [66, 79],
};

function seedAcademics(db: Database, base: Date) {
  const rand = rng(20261028);
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  for (const [collegeId, depts] of Object.entries(CURRICULUM)) {
    const college = byId(db.colleges, collegeId, 'college');
    for (const d of depts) {
      const dept: Department = {
        id: `dep_${college.code.toLowerCase()}_${d.code.toLowerCase()}`,
        collegeId,
        name: d.name,
        code: d.code,
      };
      db.departments.push(dept);
      for (const level of [1, 2] as const) {
        const subs: Subject[] = d.topics.map(([topic, teacher, credits], i) => ({
          id: `sub_${college.code.toLowerCase()}_${d.code.toLowerCase()}_${level}${i + 1}`,
          departmentId: dept.id,
          code: `${d.code}${level}0${i + 1}`,
          name: `${topic}${level === 1 ? ' I' : ' II'}`,
          teacher,
          credits,
          level,
        }));
        db.subjects.push(...subs);
        // 4 periods a week per course, no clashes
        const free: [number, [string, string]][] = [];
        for (let day = 1; day <= 6; day++) for (const p of PERIODS) free.push([day, p]);
        for (let i = free.length - 1; i > 0; i--) {
          const j = int(0, i);
          [free[i], free[j]] = [free[j], free[i]];
        }
        let k = 0;
        for (const sub of subs)
          for (let n = 0; n < 4; n++) {
            const [day, [start, end]] = free[k++];
            const slot: TimetableSlot = {
              id: `tt_${sub.id}_${n}`,
              subjectId: sub.id,
              day: day as TimetableSlot['day'],
              start,
              end,
              room: `${college.code}-${d.code}-${int(101, 312)}`,
            };
            db.timetable.push(slot);
          }
      }
    }
  }
  const at = (days: number) => daysAgo(days, base).toISOString();
  for (const u of db.users) {
    if (u.role !== 'student') continue;
    enrollStudent(db, u);
    const [ability, regularity] = PROFILE[u.id] ?? [70, 85];
    for (const e of db.enrollments.filter((x) => x.studentId === u.id)) {
      const exams: [string, number, number][] = e.current
        ? [
            ['Internal 1', 50, 40],
            ['Internal 2', 50, 9],
          ]
        : [['Semester End', 100, 120]];
      for (const [examType, max, ago] of exams) {
        const pct = Math.max(30, Math.min(100, ability + int(-14, 10)));
        const marks = Math.round((pct / 100) * max);
        const [grade, gradePoint] = gradeFor((marks / max) * 100);
        db.results.push({
          id: `res_${u.id}_${e.subjectId}_${examType.replace(' ', '')}`,
          studentId: u.id,
          subjectId: e.subjectId,
          semester: e.semester,
          examType: examType as Result['examType'],
          marks,
          maxMarks: max,
          grade,
          gradePoint,
          publishedAt: at(ago),
        });
      }
      if (e.current) {
        const total = int(34, 44);
        db.attendance.push({
          studentId: u.id,
          subjectId: e.subjectId,
          totalClasses: total,
          attended: Math.min(
            total,
            Math.round((total * Math.min(100, regularity + int(-8, 6))) / 100),
          ),
          updatedAt: at(1),
        });
      }
    }
  }
  const NOTICES: [string, string, boolean, number][] = [
    [
      'Semester-end examination schedule',
      'Semester-end examinations begin on 1 December. Hall tickets are issued only to students with at least 75% attendance. Check the Timetable page for your classes until then.',
      true,
      2,
    ],
    [
      'Internal 2 marks published',
      'Internal 2 marks for all current subjects are now on the Results page. If something looks wrong, raise an Examination ticket within 7 days.',
      false,
      9,
    ],
  ];
  const admins = db.users.filter((u): u is Admin => u.role === 'admin');
  const managerOf = (collegeId: string) =>
    (admins.find((a) => a.collegeIds.includes(collegeId)) ?? admins[0]).id;
  for (const c of db.colleges)
    for (const [title, body, pinned, ago] of NOTICES) {
      db.notices.push({
        id: `ntc_${c.code.toLowerCase()}_${ago}`,
        collegeId: c.id,
        authorId: managerOf(c.id),
        title,
        body,
        pinned,
        createdAt: at(ago),
        updatedAt: at(ago),
      });
    }
  db.notices.push({
    id: 'ntc_lbs_placement',
    collegeId: 'col_lbs',
    authorId: managerOf('col_lbs'),
    title: 'Summer internship applications open',
    body: 'Applications for the summer internship programme close on 15 November. Submit your CV through the placement cell.',
    pinned: false,
    createdAt: at(4),
    updatedAt: at(4),
  });
}
