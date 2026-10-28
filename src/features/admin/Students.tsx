import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAdminStudents, useReference } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, QueryView } from '@/components/app/Page';
import { Avatar } from '@/components/app/AppShell';
import { cn } from '@/lib/utils';

export default function Students() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [collegeId, setCollege] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const students = useAdminStudents({ q: query || undefined, collegeId: collegeId || undefined });
  const data = students.data;
  const mine =
    ref.data?.colleges.filter((c) => user?.role === 'admin' && user.collegeIds.includes(c.id)) ??
    [];
  return (
    <>
      <PageHeader
        title="Students"
        description="Students of your colleges. Click a ticket count to see that student's tickets."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              className="pl-8"
              placeholder="Search name, roll no., email, department"
              aria-label="Search students"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {mine.length > 1 && (
            <NativeSelect
              aria-label="College"
              className="w-auto"
              value={collegeId}
              onChange={(e) => setCollege(e.target.value)}
            >
              <option value="">College: all</option>
              {mine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </NativeSelect>
          )}
          {data && (
            <span className="ml-auto text-sm text-muted-foreground">
              {data.length} student{data.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <QueryView query={students}>
          {(rows) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll no.</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead>Department / year</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">CGPA</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No students match.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar name={s.fullName} photo={s.photo} size={30} />
                        <span>
                          <span className="block font-medium">{s.fullName}</span>
                          <a
                            className="text-xs text-primary hover:underline"
                            href={`mailto:${s.email}`}
                          >
                            {s.email}
                          </a>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.rollNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{s.college}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.department}, year {s.yearOfStudy}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        s.attendance != null && s.attendance < 75 && 'text-red-600',
                      )}
                    >
                      {s.attendance != null ? `${s.attendance}%` : '–'}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.cgpa != null ? s.cgpa.toFixed(2) : '–'}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.totalTickets ? (
                        <Link
                          className="text-primary hover:underline"
                          to={`/admin?q=${encodeURIComponent(s.rollNumber)}`}
                        >
                          {s.openTickets} open / {s.totalTickets}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryView>
      </Card>
    </>
  );
}
