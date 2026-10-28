import { Download } from 'lucide-react';
import { useReference, useResults } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, Loading, ErrorState } from '@/components/app/Page';
import { cn, fmtDate } from '@/lib/utils';

const gradeTone = (g: string) =>
  g === 'F'
    ? 'bg-red-50 text-red-700'
    : g === 'O' || g === 'A+'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-muted text-foreground';

export default function Results() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const { data: r, isLoading, error } = useResults();
  if (user?.role !== 'student') return null;
  const college = ref.data?.colleges.find((c) => c.id === user.collegeId)?.name ?? '';
  const empty = !r || r.semesters.length === 0;
  const latest = r?.semesters[0]?.exams[0];
  return (
    <>
      <PageHeader
        title="Results"
        description="Marks, grades and grade points by semester and exam. SGPA and CGPA are calculated from semester-end results."
        actions={
          <Button
            variant="outline"
            disabled={empty}
            onClick={async () => {
              if (!r) return;
              // jsPDF is large, so it is only loaded when someone actually downloads
              const { downloadResultsPdf } = await import('./resultsPdf');
              downloadResultsPdf(r, {
                name: user.fullName,
                rollNumber: user.rollNumber,
                department: user.department,
                year: user.yearOfStudy,
                college,
              });
            }}
          >
            <Download /> Download PDF
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : !r || !latest ? (
        <Card className="p-8 text-center text-muted-foreground">
          No results have been published for you yet.
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">CGPA</p>
              <p className="mt-1 text-3xl font-bold text-primary">
                {r.cgpa != null ? r.cgpa.toFixed(2) : '–'}
              </p>
              <p className="text-xs text-muted-foreground">out of 10</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Credits completed</p>
              <p className="mt-1 text-3xl font-bold">{r.creditsCompleted}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Latest exam</p>
              <p className="mt-1 text-3xl font-bold">{latest.percentage}%</p>
              <p className="text-xs text-muted-foreground">
                Semester {r.semesters[0].semester} · {latest.examType}
              </p>
            </Card>
          </div>
          <div className="space-y-6">
            {r.semesters.flatMap((s) =>
              s.exams.map((e) => (
                <Card key={`${s.semester}-${e.examType}`}>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle>
                      Semester {s.semester} · {e.examType}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {e.totalMarks} / {e.totalMax}
                      </span>
                      <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
                        {e.percentage}%
                      </span>
                      {e.sgpa != null && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          SGPA {e.sgpa.toFixed(2)}
                        </span>
                      )}
                      {e.failed > 0 && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                          {e.failed} failed
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {e.subjects.map((x) => (
                        <TableRow key={x.code}>
                          <TableCell>
                            <span className="font-medium">{x.name}</span>
                            <span className="block font-mono text-xs text-muted-foreground">
                              {x.code}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{x.credits}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {x.marks} / {x.maxMarks}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-xs font-bold',
                                gradeTone(x.grade),
                              )}
                            >
                              {x.grade}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{x.gradePoint}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="border-t px-5 py-2 text-xs text-muted-foreground">
                    Published {fmtDate(e.publishedAt)}
                  </p>
                </Card>
              )),
            )}
          </div>
        </>
      )}
    </>
  );
}
