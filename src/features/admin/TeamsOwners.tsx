import { useReference } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, Loading } from '@/components/app/Page';

export default function TeamsOwners() {
  const { data } = useReference();
  const user = useSession((s) => s.user);
  if (!data) return <Loading />;
  const colleges = data.colleges.filter(
    (c) => user?.role === 'admin' && user.collegeIds.includes(c.id),
  );
  return (
    <>
      <PageHeader
        title="Teams & owners"
        description='Functional owners do not log in. When they report progress, record it on the ticket with "on behalf of".'
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Handles</TableHead>
              {colleges.map((c) => (
                <TableHead key={c.id}>{c.code} owner</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.teams.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.description}</TableCell>
                {colleges.map((c) => {
                  const o = data.owners.find((x) => x.teamId === t.id && x.collegeId === c.id);
                  return (
                    <TableCell key={c.id}>
                      {o ? (
                        <>
                          <span className="block">{o.name}</span>
                          <a
                            className="text-xs text-primary hover:underline"
                            href={`mailto:${o.email}`}
                          >
                            {o.email}
                          </a>
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
