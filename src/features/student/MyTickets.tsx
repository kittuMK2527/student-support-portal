import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import type { TicketStatus } from '@/types';
import { STATUSES } from '@/types';
import { STATUS_LABEL } from '@/lib/workflow/transitions';
import { useMyTickets } from '@/lib/api/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, QueryView } from '@/components/app/Page';
import { StatusBadge, categoryLabel } from '@/components/app/StatusBadge';
import { fmtDate, timeAgo } from '@/lib/utils';

export default function MyTickets() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') || undefined) as TicketStatus | undefined;
  const tickets = useMyTickets(status);
  const data = tickets.data;
  return (
    <>
      <PageHeader
        title="My tickets"
        description="Only you and your campus manager can see these."
        actions={
          <Button asChild>
            <Link to="/student/new">
              <Plus /> New ticket
            </Link>
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <label htmlFor="status-filter" className="text-sm text-muted-foreground">
            Status
          </label>
          <NativeSelect
            id="status-filter"
            className="w-auto"
            value={status ?? ''}
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          {data && (
            <span className="ml-auto text-sm text-muted-foreground">
              {data.length} ticket{data.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <QueryView query={tickets}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Inbox className="size-10 text-muted-foreground/50" aria-hidden />
                <p className="mt-3 font-semibold">
                  {status
                    ? `No ${STATUS_LABEL[status]} tickets`
                    : 'You have not raised any tickets yet'}
                </p>
                {!status && (
                  <Button asChild className="mt-4">
                    <Link to="/student/new">
                      <Plus /> Raise your first ticket
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned team</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link
                          to={`/student/tickets/${t.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {t.id}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{categoryLabel(t)}</TableCell>
                      <TableCell className="max-w-xs">
                        <Link
                          to={`/student/tickets/${t.id}`}
                          className="block truncate font-medium hover:text-primary"
                          title={t.subject}
                        >
                          {t.subject}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDate(t.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {t.assignedTeam ?? <span className="text-muted-foreground">Not yet</span>}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-muted-foreground"
                        title={fmtDate(t.updatedAt)}
                      >
                        {timeAgo(t.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryView>
      </Card>
    </>
  );
}
