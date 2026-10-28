import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, Circle, Compass, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { DEMO } from '@/lib/db/seed';
import { useUi } from '@/lib/store/session';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DemoGuide({ inline = false }: { inline?: boolean }) {
  const { guideOpen: stored, setGuideOpen } = useUi();
  const guideOpen = inline || stored; // inline (login/register) is always expanded; the floating one starts collapsed
  const { data: p } = useQuery({
    queryKey: ['demo', 'progress'],
    queryFn: api.demo.progress,
    refetchInterval: 1500,
  });
  const t = p?.ticketId;
  const steps = [
    {
      done: p?.registered,
      title: 'A student registers',
      how: (
        <>
          Log out, then{' '}
          <Link className="text-primary underline" to="/register">
            Create an account
          </Link>{' '}
          at Riverside College of Engineering.
        </>
      ),
    },
    {
      done: p?.submitted,
      title: 'They submit a Placement ticket',
      how: (
        <>
          New ticket → category <b>Placement</b>. Note the TKT ID on the success screen.
        </>
      ),
    },
    {
      done: p?.managerEmailed,
      title: 'The campus manager gets an email',
      how: (
        <>
          Log in as admin ({DEMO.admin.email}) →{' '}
          <Link className="text-primary underline" to="/admin/outbox">
            Email Outbox
          </Link>
          .
        </>
      ),
    },
    {
      done: p?.assignedWithAction,
      title: 'Manager assigns it to Placement with a next action',
      how: (
        <>
          Open{' '}
          {t ? (
            <Link className="text-primary underline" to={`/admin/tickets/${t}`}>
              {t}
            </Link>
          ) : (
            'the ticket'
          )}{' '}
          → Assign to a team (Placement, Karthik Raman, rationale) → add an action item.
        </>
      ),
    },
    {
      done: p?.ownerProgress,
      title: "The owner's progress is recorded",
      how: <>Add update → public, "on behalf of" Karthik Raman.</>,
    },
    {
      done: p?.closed,
      title: 'Manager resolves and closes it',
      how: <>Mark resolved with a resolution note, then Close ticket.</>,
    },
    {
      done: p?.closureEmails,
      title: 'Student and manager get closure emails',
      how: <>Check the Email Outbox (two "closed" emails).</>,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const reset = async () => {
    if (window.confirm('Reset all demo data? Every change you made will be lost.')) {
      await api.demo.reset();
      window.location.href = '/login';
    }
  };

  return (
    <aside
      className={cn(
        'rounded-xl border bg-card shadow-lg',
        inline
          ? 'mt-6 w-full shadow-sm'
          : 'fixed right-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))]',
      )}
      aria-label="Guided demo"
    >
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setGuideOpen(!guideOpen)}
        aria-expanded={guideOpen}
      >
        <Compass className="size-4 text-primary" aria-hidden />
        <span className="flex-1 text-sm font-semibold">
          Guided demo{' '}
          <span className="font-normal text-muted-foreground">
            · {doneCount}/{steps.length}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', guideOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
      {guideOpen && (
        <div className="border-t px-4 pt-2 pb-3">
          <div className="mb-2 h-1.5 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <ol className={cn('space-y-2', !inline && 'max-h-[45vh] overflow-y-auto')}>
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-2 text-sm">
                {s.done ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    aria-label="done"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-label="not done"
                  />
                )}
                <span>
                  <span
                    className={cn('font-medium', s.done && 'text-muted-foreground line-through')}
                  >
                    {i + 1}. {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{s.how}</span>
                </span>
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={reset}>
            <RotateCcw /> Reset demo data
          </Button>
        </div>
      )}
    </aside>
  );
}
