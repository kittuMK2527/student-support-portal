import { Pin } from 'lucide-react';
import { useNotices } from '@/lib/api/hooks';
import { Card } from '@/components/ui/card';
import { PageHeader, QueryView } from '@/components/app/Page';
import { cn, fmtDate } from '@/lib/utils';

export default function Notices() {
  const query = useNotices();
  return (
    <>
      <PageHeader title="Notices" description="Announcements from your campus manager." />
      <QueryView query={query}>
        {(data) =>
          data.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No notices yet.</Card>
          ) : (
            <ul className="space-y-4">
              {data.map((n) => (
                <li key={n.id}>
                  <Card className={cn('p-5', n.pinned && 'border-amber-200')}>
                    <div className="flex flex-wrap items-center gap-2">
                      {n.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <Pin className="size-3" /> Pinned
                        </span>
                      )}
                      <h2 className="font-semibold">{n.title}</h2>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-line">{n.body}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {n.authorName} · {fmtDate(n.createdAt)}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
    </>
  );
}
