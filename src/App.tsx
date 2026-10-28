import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Home,
  ListChecks,
  Megaphone,
  Plus,
  Trophy,
  User,
} from 'lucide-react';
import { GuestOnly, RequireRole, SessionGate } from '@/features/auth/guards';
import AppShell from '@/components/app/AppShell';
import { adminRoutes } from '@/features/admin/routes';
import { useSession } from '@/lib/store/session';
import { useReference } from '@/lib/api/hooks';
import { Loading } from '@/components/app/Page';

const Login = lazy(() => import('@/features/auth/Login'));
const Register = lazy(() => import('@/features/auth/Register'));
const MyTickets = lazy(() => import('@/features/student/MyTickets'));
const NewTicket = lazy(() => import('@/features/student/NewTicket'));
const TicketSubmitted = lazy(() => import('@/features/student/TicketSubmitted'));
const StudentTicketDetail = lazy(() => import('@/features/student/StudentTicketDetail'));
const StudentHome = lazy(() => import('@/features/student/Home'));
const Profile = lazy(() => import('@/features/student/Profile'));
const Subjects = lazy(() => import('@/features/student/Subjects'));
const Results = lazy(() => import('@/features/student/Results'));
const Attendance = lazy(() => import('@/features/student/Attendance'));
const Timetable = lazy(() => import('@/features/student/Timetable'));
const Notices = lazy(() => import('@/features/student/Notices'));

function StudentShell() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const college =
    user?.role === 'student' ? ref.data?.colleges.find((c) => c.id === user.collegeId) : undefined;
  const sub =
    user?.role === 'student'
      ? `${user.rollNumber} · ${user.department}, year ${user.yearOfStudy}${college ? ` · ${college.name}` : ''}`
      : '';
  return (
    <AppShell
      area="Student"
      subtitle={sub}
      nav={[
        { to: '/student', label: 'Home', icon: Home, end: true, group: 'My studies' },
        { to: '/student/profile', label: 'Profile', icon: User, group: 'My studies' },
        { to: '/student/subjects', label: 'Subjects', icon: BookOpen, group: 'My studies' },
        { to: '/student/results', label: 'Results', icon: Trophy, group: 'My studies' },
        {
          to: '/student/attendance',
          label: 'Attendance',
          icon: CalendarCheck,
          group: 'My studies',
        },
        { to: '/student/timetable', label: 'Timetable', icon: CalendarDays, group: 'My studies' },
        { to: '/student/notices', label: 'Notices', icon: Megaphone, group: 'My studies' },
        { to: '/student/tickets', label: 'My tickets', icon: ListChecks, group: 'Support' },
        { to: '/student/new', label: 'New ticket', icon: Plus, group: 'Support' },
      ]}
    />
  );
}

export default function App() {
  return (
    <SessionGate>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route element={<RequireRole allow="student" />}>
            <Route path="/student" element={<StudentShell />}>
              <Route index element={<StudentHome />} />
              <Route path="profile" element={<Profile />} />
              <Route path="subjects" element={<Subjects />} />
              <Route path="results" element={<Results />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="timetable" element={<Timetable />} />
              <Route path="notices" element={<Notices />} />
              <Route path="tickets" element={<MyTickets />} />
              <Route path="new" element={<NewTicket />} />
              <Route path="submitted/:id" element={<TicketSubmitted />} />
              <Route path="tickets/:id" element={<StudentTicketDetail />} />
            </Route>
          </Route>
          {adminRoutes}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </SessionGate>
  );
}
