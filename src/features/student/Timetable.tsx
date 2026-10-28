import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useTimetable } from '@/lib/api/hooks';
import { Card } from '@/components/ui/card';
import { PageHeader, Loading, ErrorState } from '@/components/app/Page';
import { cn } from '@/lib/utils';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLOURS = [
  'bg-teal-50 border-teal-200',
  'bg-sky-50 border-sky-200',
  'bg-amber-50 border-amber-200',
  'bg-violet-50 border-violet-200',
  'bg-rose-50 border-rose-200',
];

export default function Timetable() {
  const { data, isLoading, error } = useTimetable();
  const slots = data ?? [];
  const times = [...new Set(slots.map((s) => `${s.start}-${s.end}`))].sort();
  const codes = [...new Set(slots.map((s) => s.code))].sort();
  const colour = (c: string) => COLOURS[codes.indexOf(c) % COLOURS.length];
  const [today] = useState(() => new Date().getDay());
  return (
    <>
      <PageHeader title="Timetable" description="Your weekly class schedule for this semester." />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : slots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No timetable yet.</Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-muted/60 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th className="w-28 px-3 py-2.5 text-left">Time</th>
                  {DAYS.slice(1).map((d, i) => (
                    <th
                      key={d}
                      className={cn('px-2 py-2.5 text-left', today === i + 1 && 'text-primary')}
                    >
                      {d.slice(0, 3)}
                      {today === i + 1 && ' · Today'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {times.map((t) => (
                  <tr key={t}>
                    <td className="px-3 py-2 align-top text-xs font-medium whitespace-nowrap text-muted-foreground">
                      {t.replace('-', ' – ')}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((d) => {
                      const s = slots.find((x) => x.day === d && `${x.start}-${x.end}` === t);
                      return (
                        <td
                          key={d}
                          className={cn('p-1.5 align-top', today === d && 'bg-accent/40')}
                        >
                          {s && (
                            <div className={cn('rounded-md border px-2 py-1.5', colour(s.code))}>
                              <p className="truncate text-xs font-semibold" title={s.name}>
                                {s.name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">{s.room}</p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-4 md:hidden">
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const day = slots.filter((s) => s.day === d);
              return (
                <Card key={d}>
                  <h2
                    className={cn(
                      'border-b px-4 py-2.5 text-sm font-semibold',
                      today === d && 'bg-accent text-accent-foreground',
                    )}
                  >
                    {DAYS[d]}
                    {today === d && ' · Today'}
                  </h2>
                  {day.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No classes</p>
                  ) : (
                    <ul className="divide-y">
                      {day.map((s) => (
                        <li key={s.id} className="flex gap-3 px-4 py-3">
                          <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                            {s.start} – {s.end}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{s.name}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" />
                              {s.room} · {s.teacher}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
