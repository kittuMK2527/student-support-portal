import { useAttendance } from '@/lib/api/hooks';
import { Card } from '@/components/ui/card';
import { PageHeader, QueryView } from '@/components/app/Page';
import { cn } from '@/lib/utils';

function advice(a: number, t: number, req: number) {
  if (!t) return '';
  if ((a / t) * 100 < req) {
    const n = Math.ceil((req * t - 100 * a) / (100 - req));
    return `Attend the next ${n} class${n === 1 ? '' : 'es'} to reach ${req}%`;
  }
  const spare = Math.floor((100 * a - req * t) / req);
  return spare > 0
    ? `You can miss ${spare} more and stay at ${req}%`
    : 'Exactly at the limit: do not miss the next class';
}

export default function Attendance() {
  const query = useAttendance();
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Subject-wise attendance for the current semester."
      />
      <QueryView query={query}>
        {(data) =>
          data.subjects.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No attendance has been recorded for you yet.
            </Card>
          ) : (
            <>
              <Card
                className={cn(
                  'mb-6 flex flex-wrap items-center justify-between gap-4 p-5',
                  data.overall.percentage! < data.required && 'border-red-200 bg-red-50/50',
                )}
              >
                <div>
                  <p className="text-sm text-muted-foreground">Overall attendance</p>
                  <p className="text-3xl font-bold">{data.overall.percentage}%</p>
                  <p className="text-xs text-muted-foreground">
                    {data.overall.attended} of {data.overall.total} classes · {data.required}%
                    needed to sit the semester-end exams
                  </p>
                </div>
                {data.overall.percentage! < data.required && (
                  <p className="max-w-sm text-sm font-medium text-red-700">
                    Your attendance is below {data.required}%. You may not be allowed to write the
                    semester-end exams.
                  </p>
                )}
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                {data.subjects.map((s) => {
                  const low = (s.percentage ?? 0) < data.required;
                  return (
                    <Card key={s.code} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{s.code}</span> · {s.teacher}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-lg font-bold',
                            low ? 'text-red-600' : 'text-emerald-600',
                          )}
                        >
                          {s.percentage}%
                        </span>
                      </div>
                      <div
                        className="relative mt-3 h-2.5 rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={s.percentage ?? 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${s.name} attendance`}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            low ? 'bg-red-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${s.percentage}%` }}
                        />
                        <div
                          className="absolute -top-1 h-4 w-0.5 bg-foreground/40"
                          style={{ left: `${data.required}%` }}
                          title={`${data.required}% requirement`}
                        />
                      </div>
                      <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {s.attended} / {s.total} classes
                        </span>
                        <span className={cn(low && 'font-medium text-red-600')}>
                          {advice(s.attended, s.total, data.required)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )
        }
      </QueryView>
    </>
  );
}
