import { useState } from 'react';
import { Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAdminAction, useAdminNotices, useReference } from '@/lib/api/hooks';
import { useSession } from '@/lib/store/session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, QueryView } from '@/components/app/Page';
import { cn, fmtDate } from '@/lib/utils';

type Form = { id?: string; collegeId: string; title: string; body: string; pinned: boolean };

export default function AdminNotices() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const query = useAdminNotices();
  const mine =
    ref.data?.colleges.filter((c) => user?.role === 'admin' && user.collegeIds.includes(c.id)) ??
    [];
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState('');
  const save = useAdminAction((f: Form) =>
    f.id ? api.admin.updateNotice(f.id, f) : api.admin.createNotice(f),
  );
  const remove = useAdminAction((id: string) => api.admin.deleteNotice(id));
  const collegeName = (id: string) => ref.data?.colleges.find((c) => c.id === id)?.code ?? '';

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements appear on the Home and Notices pages of every student of that college."
        actions={
          <Button
            onClick={() => {
              setForm({ collegeId: mine[0]?.id ?? '', title: '', body: '', pinned: false });
              setErrors({});
              setFlash('');
            }}
          >
            <Plus /> New notice
          </Button>
        }
      />
      <Alert tone="success" className="mb-4">
        {flash}
      </Alert>
      <QueryView query={query}>
        {(data) =>
          data.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No notices yet.</Card>
          ) : (
            <ul className="space-y-3">
              {data.map((n) => (
                <li key={n.id}>
                  <Card className={cn('flex gap-3 p-5', n.pinned && 'border-amber-200')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                          {collegeName(n.collegeId)}
                        </span>
                        {n.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            <Pin className="size-3" /> Pinned
                          </span>
                        )}
                        <h2 className="font-semibold">{n.title}</h2>
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-line">{n.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {n.authorName} · {fmtDate(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${n.title}`}
                        onClick={() => {
                          setForm({
                            id: n.id,
                            collegeId: n.collegeId,
                            title: n.title,
                            body: n.body,
                            pinned: n.pinned,
                          });
                          setErrors({});
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${n.title}`}
                        onClick={() => {
                          if (
                            window.confirm(`Delete "${n.title}"? Students will no longer see it.`)
                          )
                            remove.mutate(n.id, { onSuccess: () => setFlash('Notice deleted.') });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
      {form && (
        <Dialog open onOpenChange={(o) => !o && setForm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? 'Edit notice' : 'New notice'}</DialogTitle>
              <DialogDescription>
                Students of the chosen college see it immediately.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form, {
                  onSuccess: () => {
                    setFlash(form.id ? 'Notice updated.' : 'Notice posted.');
                    setForm(null);
                  },
                  onError: (err) =>
                    setErrors(
                      err instanceof ApiError && err.fields ? err.fields : { _: err.message },
                    ),
                });
              }}
            >
              <Alert tone="error">{errors._}</Alert>
              {!form.id && mine.length > 1 && (
                <Field id="n-college" label="College" error={errors.collegeId}>
                  <NativeSelect
                    value={form.collegeId}
                    onChange={(e) => setForm({ ...form, collegeId: e.target.value })}
                  >
                    {mine.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field id="n-title" label="Title" error={errors.title}>
                <Input
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field id="n-body" label="Notice" error={errors.body}>
                <Textarea
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                />{' '}
                Pin to the top
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {form.id ? 'Save' : 'Post notice'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
