import { Suspense, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LifeBuoy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { cn } from '@/lib/utils';
import DemoGuide from '@/features/demo/DemoGuide';
import { Loading } from './Page';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: ReactNode;
  group?: string;
}

function Avatar({ name, photo, size = 32 }: { name: string; photo?: string; size?: number }) {
  if (photo)
    return (
      <img
        src={photo}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-1 ring-border"
      />
    );
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground"
    >
      {letters}
    </span>
  );
}
export { Avatar };

export default function AppShell({
  area,
  subtitle,
  nav,
}: {
  area: string;
  subtitle: string;
  nav: NavItem[];
}) {
  const user = useSession((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const doLogout = () => logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  const groups = [...new Set(nav.map((n) => n.group ?? ''))];
  const link = ({ to, label, icon: Icon, end, badge }: NavItem, mobile = false) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        mobile
          ? cn(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium',
              isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
            )
          : cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
      {badge}
    </NavLink>
  );
  if (!user) return null;
  const photo = user.role === 'student' ? user.photo : undefined;

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex items-center gap-2 px-5 py-4">
          <LifeBuoy className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Student Support Portal</span>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3" aria-label="Main">
          {groups.map((g) => (
            <div key={g || 'main'}>
              {g && (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {g}
                </p>
              )}
              <div className="space-y-0.5">
                {nav.filter((n) => (n.group ?? '') === g).map((n) => link(n))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <Avatar name={user.fullName} photo={photo} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{area}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            loading={logout.isPending}
            onClick={doLogout}
          >
            <LogOut /> Log out
          </Button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <LifeBuoy className="size-5 text-primary lg:hidden" aria-hidden />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">
              <span className="lg:hidden">Support Portal · </span>
              {area}
            </p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <span className="lg:hidden">
            <Avatar name={user.fullName} photo={photo} size={30} />
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={doLogout}
            aria-label="Log out"
          >
            <LogOut />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 lg:hidden" aria-label="Main">
          {nav.map((n) => link(n, true))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      <DemoGuide />
    </div>
  );
}
