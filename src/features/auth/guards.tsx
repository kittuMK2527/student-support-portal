// UI-only redirects; the API enforces access on every call.
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store/session';
import { Loading } from '@/components/app/Page';
import { homeFor } from './Login';

export function SessionGate({ children }: { children: React.ReactNode }) {
  const { ready, setUser, setReady } = useSession();
  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(setReady);
  }, [setUser, setReady]);
  return ready ? (
    <>{children}</>
  ) : (
    <div className="min-h-screen">
      <Loading />
    </div>
  );
}

export function RequireRole({ allow }: { allow: 'student' | 'admin' }) {
  const user = useSession((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.role !== allow) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const user = useSession((s) => s.user);
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />;
}
