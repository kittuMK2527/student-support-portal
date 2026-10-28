import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CATEGORIES } from '@/types';
import { useCreateTicket } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/app/Page';

export default function NewTicket() {
  const nav = useNavigate();
  const create = useCreateTicket();
  const [f, setF] = useState({ category: '', customCategory: '', subject: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setF({ ...f, [k]: e.target.value });
      if (errors[k]) setErrors({ ...errors, [k]: '' });
    };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.category) errs.category = 'Choose a category';
    if (f.category === 'Other' && !f.customCategory.trim())
      errs.customCategory = 'Say what this is about';
    if (!f.subject.trim()) errs.subject = 'Subject is required';
    if (f.description.trim().length < 20)
      errs.description = 'Describe the issue in at least 20 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    create.mutate(
      { ...f, customCategory: f.category === 'Other' ? f.customCategory : undefined },
      {
        onSuccess: (t) => nav(`/student/submitted/${t.id}`, { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError && err.fields) setErrors(err.fields);
        },
      },
    );
  };

  return (
    <>
      <Link
        to="/student/tickets"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My tickets
      </Link>
      <PageHeader
        title="New ticket"
        description="Your campus manager reviews every ticket and routes it to the right team."
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-5">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Alert tone="error">
              {create.error && !(create.error instanceof ApiError && create.error.fields)
                ? create.error.message
                : null}
            </Alert>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="category" label="Category" error={errors.category}>
                <NativeSelect value={f.category} onChange={set('category')}>
                  <option value="">Choose a category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {f.category === 'Other' && (
                <Field id="customCategory" label="What is it about?" error={errors.customCategory}>
                  <Input
                    maxLength={40}
                    placeholder="e.g. ID card, Library"
                    value={f.customCategory}
                    onChange={set('customCategory')}
                  />
                </Field>
              )}
            </div>
            <Field
              id="subject"
              label="Subject"
              error={errors.subject}
              hint={`${f.subject.length}/100`}
            >
              <Input
                maxLength={100}
                value={f.subject}
                onChange={set('subject')}
                placeholder="One line summary"
              />
            </Field>
            <Field
              id="description"
              label="Description"
              error={errors.description}
              hint={`${f.description.trim().length} characters (at least 20)`}
            >
              <Textarea
                rows={6}
                maxLength={4000}
                value={f.description}
                onChange={set('description')}
                placeholder="What happened, when, and what you need."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link to="/student/tickets">Cancel</Link>
              </Button>
              <Button type="submit" loading={create.isPending}>
                Submit ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
