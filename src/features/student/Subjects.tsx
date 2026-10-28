import { useSubjects } from '@/lib/api/hooks';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, QueryView } from '@/components/app/Page';

export default function Subjects() {
  const query = useSubjects();
  return (
    <>
      <PageHeader
        title="Subjects"
        description="Your registered subjects with code, teacher and credits."
      />
      <QueryView query={query}>
        {(data) =>
          data.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No subjects registered yet.
            </Card>
          ) : (
            <div className="space-y-6">
              {[...new Set(data.map((s) => s.semester))].map((sem) => {
                const list = data.filter((s) => s.semester === sem);
                return (
                  <Card key={sem}>
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle>
                        Semester {sem}{' '}
                        {list[0].current && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Current
                          </span>
                        )}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {list.reduce((a, s) => a + s.credits, 0)} credits
                      </span>
                    </CardHeader>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {s.code}
                            </TableCell>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>{s.teacher}</TableCell>
                            <TableCell className="text-right">{s.credits}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                );
              })}
            </div>
          )
        }
      </QueryView>
    </>
  );
}
