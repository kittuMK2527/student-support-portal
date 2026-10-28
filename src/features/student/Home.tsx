import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Megaphone,
  MessageCircleQuestion,
  Pin,
  Plus,
  Ticket,
  Trophy,
} from 'lucide-react';
import { useStudentHome } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Loading, ErrorState } from '@/components/app/Page';
import { cn, timeAgo } from '@/lib/utils';

function Stat({
  to,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/40"
    >
      <span className={cn('inline-flex rounded-md p-1.5', tone)}>
        <Icon className="size-4" />
      </span>
      <span className="mt-2 block text-2xl font-bold">{value}</span>
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
    </Link>
  );
}

export default function StudentHome() {
  const user = useSession((s) => s.user);
  const { data: h, isLoading, error } = useStudentHome();
  const [hour] = useState(() => new Date().getHours());
  if (user?.role !== 'student') return null;
  return (
    <>
      <section className="mb-6 rounded-2xl bg-gradient-to-r from-teal-700 to-teal-500 p-6 text-white shadow-sm">
        <p className="text-sm text-teal-50">
          {hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'},
        </p>
        <h1 className="mt-1 text-2xl font-bold">{user.fullName}</h1>
        <p className="mt-1 text-sm text-teal-50">
          {user.department} · Year {user.yearOfStudy}
          {h ? ` · Semester ${h.semester}` : ''} · Roll no. {user.rollNumber}
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link to="/student/new">
            <Plus /> Raise a ticket
          </Link>
        </Button>
      </section>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        h && (
          <>
            {h.tickets.awaitingYou > 0 && (
              <Alert tone="info" className="mb-4">
                <span className="inline-flex items-center gap-1">
                  <MessageCircleQuestion className="size-4" /> Your campus manager is waiting for
                  your reply on {h.tickets.awaitingYou} ticket
                  {h.tickets.awaitingYou === 1 ? '' : 's'}.
                </span>{' '}
                <Link
                  className="font-medium underline"
                  to="/student/tickets?status=awaiting_student"
                >
                  Open
                </Link>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                to="/student/subjects"
                icon={BookOpen}
                tone="bg-sky-50 text-sky-700"
                label="Subjects this semester"
                value={h.subjects.count}
                hint={`${h.subjects.credits} credits`}
              />
              <Stat
                to="/student/results"
                icon={Trophy}
                tone="bg-emerald-50 text-emerald-700"
                label="Latest result"
                value={h.latestResult ? `${h.latestResult.percentage}%` : '–'}
                hint={
                  h.latestResult
                    ? `Sem ${h.latestResult.semester} · ${h.latestResult.examType}${h.cgpa ? ` · CGPA ${h.cgpa.toFixed(2)}` : ''}`
                    : 'No results published yet'
                }
              />
              <Stat
                to="/student/attendance"
                icon={CalendarCheck}
                tone={
                  h.attendance.percentage != null && h.attendance.percentage < 75
                    ? 'bg-red-50 text-red-700'
                    : 'bg-violet-50 text-violet-700'
                }
                label="Attendance"
                value={h.attendance.percentage != null ? `${h.attendance.percentage}%` : '–'}
                hint={
                  h.attendance.percentage == null
                    ? 'Not recorded yet'
                    : h.attendance.percentage < 75
                      ? 'Below the 75% requirement'
                      : `${h.attendance.attended} of ${h.attendance.total} classes`
                }
              />
              <Stat
                to="/student/tickets"
                icon={Ticket}
                tone="bg-amber-50 text-amber-700"
                label="Open tickets"
                value={h.tickets.open}
                hint={`${h.tickets.total} raised in total`}
              />
            </div>
            <Card className="mt-6">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="size-4 text-primary" /> Latest notices
                </CardTitle>
                <Link
                  to="/student/notices"
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  All notices <ArrowRight className="size-3.5" />
                </Link>
              </CardHeader>
              <CardContent>
                {h.notices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notices yet.</p>
                ) : (
                  <ul className="divide-y">
                    {h.notices.map((n) => (
                      <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          {n.pinned && (
                            <Pin className="size-3.5 text-amber-600" aria-label="Pinned" />
                          )}
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}
    </>
  );
}
