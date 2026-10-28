import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { GraduationCap, LayoutList, Mail, Megaphone, Users } from 'lucide-react';
import { RequireRole } from '@/features/auth/guards';
import AppShell from '@/components/app/AppShell';
import { useSession } from '@/lib/store/session';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const AdminTicketDetail = lazy(() => import('./AdminTicketDetail'));
const EmailOutbox = lazy(() => import('./EmailOutbox'));
const TeamsOwners = lazy(() => import('./TeamsOwners'));
const Students = lazy(() => import('./Students'));
const AdminNotices = lazy(() => import('./Notices'));

function AdminShell() {
  const user = useSession((s) => s.user);
  return (
    <AppShell
      area="Admin"
      subtitle={user?.role === 'admin' ? `${user.fullName} · ${user.title}` : ''}
      nav={[
        { to: '/admin', label: 'Tickets', icon: LayoutList, end: true, group: 'Support' },
        { to: '/admin/outbox', label: 'Email outbox', icon: Mail, group: 'Support' },
        { to: '/admin/teams', label: 'Teams & owners', icon: Users, group: 'Support' },
        { to: '/admin/students', label: 'Students', icon: GraduationCap, group: 'Campus' },
        { to: '/admin/notices', label: 'Notices', icon: Megaphone, group: 'Campus' },
      ]}
    />
  );
}

export const adminRoutes = (
  <Route element={<RequireRole allow="admin" />}>
    <Route path="/admin" element={<AdminShell />}>
      <Route index element={<AdminDashboard />} />
      <Route path="tickets/:id" element={<AdminTicketDetail />} />
      <Route path="outbox" element={<EmailOutbox />} />
      <Route path="teams" element={<TeamsOwners />} />
      <Route path="students" element={<Students />} />
      <Route path="notices" element={<AdminNotices />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Route>
  </Route>
);
