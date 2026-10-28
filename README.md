# Student Support Portal

A prototype for the Business Analyst assignment. Students register, see their academic records (results, attendance, timetable, notices) and raise support tickets. Campus managers review the tickets, plan actions, route them to functional teams and close them with a resolution.

Everything runs in the browser. A small mock API sits between the UI and a JSON document in `localStorage`, so the data survives a refresh. Emails are written to an outbox page instead of being sent.

There are two interfaces: Student and Admin. Functional owners (Placement, Finance, Academics, ...) don't log in. The manager records their updates on their behalf.

## Running it

Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5175
npm test           # vitest
npm run lint       # oxlint
npm run format     # prettier
npm run build
```

To start over with fresh demo data, use "Reset demo data" in the guided demo panel.

## Demo accounts

The login page has "Demo as Student" and "Demo as Admin" buttons.

| Role               | Email                     | Password    | Scope                                              |
| ------------------ | ------------------------- | ----------- | -------------------------------------------------- |
| Student            | priya.sharma@student.demo | Student@123 | own tickets and records                            |
| Campus manager     | anita.desai@rce.demo      | Admin@1234  | Riverside College of Engineering                   |
| Operations manager | rahul.menon@ops.demo      | Admin@1234  | Greenvale Arts & Science, Lakeview Business School |

The other seven students (e.g. arjun.nair@student.demo) also use Student@123.

The seed has:

- 3 colleges, 8 departments and 8 students;
- 20 tickets covering every status and category;
- results, attendance and a timetable for each student.

The ticket histories were created by calling the real API with the clock moved back, so the audit logs and emails look exactly as the app would produce them.

## Demo scenario

The guided demo panel ticks these steps off as they happen:

1. Register a new student at Riverside College of Engineering.
2. As that student, raise a Placement ticket. The success screen shows its ID (e.g. TKT-2026-000121).
3. Log in as Anita. The new-ticket email is in the Email outbox.
4. Open the ticket (it moves to Under Review). Assign it to Placement / Karthik Raman with a rationale, and add an action item.
5. Add a public update "on behalf of" Karthik Raman.
6. Mark it resolved, then close it.
7. The Email outbox has closure emails for both the student and Anita.

## Ticket lifecycle

The rules live in `src/lib/workflow/transitions.ts`. Every status change goes through `assertTransition`, and the UI only shows the moves that are allowed.

| From             | To                                                 | By                                    |
| ---------------- | -------------------------------------------------- | ------------------------------------- |
| Open             | Under Review                                       | admin (on opening the ticket)         |
| Under Review     | In Progress, Assigned to Team, Awaiting Student    | admin                                 |
| Awaiting Student | Under Review                                       | system, when the student replies      |
| Assigned to Team | In Progress, Assigned to Team (reassign), Resolved | admin                                 |
| In Progress      | Assigned to Team, Resolved                         | admin                                 |
| Resolved         | Closed                                             | admin, or system after 7 days         |
| Resolved         | Reopened                                           | student, within 7 days, with a reason |
| Reopened         | Under Review                                       | admin                                 |

Assigning needs a team, an owner and a rationale. Resolving and closing need a resolution note of at least 20 characters. A ticket is overdue when it is still active after 5 days.

## Features

| Area     | Feature                                                                                                                                                                              | Status                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Student  | Registration with inline validation (unique email, roll number unique per college, password rules), department chosen from the college's list                                        | Implemented                                         |
|          | Login, hashed passwords (salted SHA-256)                                                                                                                                             | Implemented, a real backend would use bcrypt/argon2 |
|          | Home: subjects, latest result, CGPA, attendance, open tickets, notices                                                                                                               | Implemented                                         |
|          | Profile: name, mobile, photo (email, roll number, college locked)                                                                                                                    | Implemented                                         |
|          | Subjects, results with SGPA/CGPA and a PDF download, attendance with the 75% rule, weekly timetable, notices                                                                         | Implemented                                         |
|          | Raise a ticket (7 categories, custom label for Other), ID like TKT-2026-000123, success screen                                                                                       | Implemented                                         |
|          | My tickets with status filter; ticket detail with public timeline and resolution                                                                                                     | Implemented                                         |
|          | Reply to a clarification request; reopen within 7 days                                                                                                                               | Implemented                                         |
| Admin    | Summary cards: Open, Under Review, In Progress, Awaiting Student, Resolved, Closed, Overdue                                                                                          | Implemented                                         |
|          | Ticket list: search, filters (status, category, college, team, owner, dates), sorting, paging                                                                                        | Implemented                                         |
|          | Ticket detail: student details, audit log, action plan, assign/reassign with rationale, public or internal updates (optionally on behalf of an owner), clarification, resolve, close | Implemented                                         |
|          | Students list and notices for the manager's own colleges                                                                                                                             | Implemented                                         |
|          | Admins only see their own colleges; students only their own data (enforced in the API layer)                                                                                         | Implemented                                         |
|          | Auto-close 7 days after resolution                                                                                                                                                   | Implemented                                         |
| Email    | `EmailService` interface; templates for submission, closure, routing, clarification, reopen                                                                                          | Implemented                                         |
|          | Delivery to the Email outbox page                                                                                                                                                    | Mocked                                              |
|          | Real provider (Resend, SendGrid, Nodemailer)                                                                                                                                         | Proposed, needs a server for the API key            |
| Platform | API layer and persistence                                                                                                                                                            | Mocked (browser + localStorage)                     |
|          | Entering marks, attendance and timetables                                                                                                                                            | Proposed, demo data is seeded                       |
|          | Password reset, attachments, SLA per category, reports and CSV export                                                                                                                | Proposed                                            |

## Layout

```
src/
  types/                 domain types
  lib/workflow/          transition map
  lib/api/               mock API (index.ts), ticket rules (backend.ts), academics (academics.ts), query hooks
  lib/db/                localStorage storage, seed, curriculum
  lib/email/             email service and templates
  lib/store/             Zustand session store
  features/auth|student|admin|demo
  components/ui/         shadcn-style components
```

## Assumptions

- A student in year Y is in semester 2Y-1. SGPA and CGPA use semester-end results.
- Grades: O ≥ 90, A+ ≥ 80, A ≥ 70, B+ ≥ 60, B ≥ 50, C ≥ 40, otherwise F.
- Students see which team handles their ticket, not the owner's name or email.
- Opening an Open ticket counts as acknowledging it.

## Author

Saimanikanta (veeraboinajashwanth@gmail.com)
