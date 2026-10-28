import { useRef, useState } from 'react';
import { Camera, Lock, Trash2 } from 'lucide-react';
import { useSession } from '@/lib/store/session';
import { useReference, useUpdateProfile } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/app/Page';
import { Avatar } from '@/components/app/AppShell';

// keep photos small enough for localStorage
function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256,
        scale = Math.max(size / img.width, size / img.height);
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Your browser could not process this image.'));
      ctx.drawImage(
        img,
        (size - img.width * scale) / 2,
        (size - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('This file could not be read as an image.'));
    img.src = URL.createObjectURL(file);
  });
}

function ReadOnly({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-1">
        {label} <Lock className="size-3 text-muted-foreground" aria-label="read-only" />
      </Label>
      <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

export default function Profile() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const update = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(() => ({
    fullName: user?.fullName ?? '',
    mobile: user?.role === 'student' ? (user.mobile ?? '') : '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (user?.role !== 'student') return null;
  const college = ref.data?.colleges.find((c) => c.id === user.collegeId);
  const changed = f.fullName.trim() !== user.fullName || f.mobile !== (user.mobile ?? '');
  const onErr = (e: Error) => {
    if (e instanceof ApiError && e.fields) setErrors(e.fields);
    setMsg({ tone: 'error', text: e.message });
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setMsg(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return setMsg({ tone: 'error', text: 'Use a JPG, PNG or WEBP image.' });
    if (file.size > 5 * 1024 * 1024)
      return setMsg({ tone: 'error', text: 'The photo must be 5 MB or smaller.' });
    try {
      update.mutate(
        { photo: await resizePhoto(file) },
        { onSuccess: () => setMsg({ tone: 'success', text: 'Photo updated.' }), onError: onErr },
      );
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="You can change your name, mobile number and photo. Email, roll number, college, department and year are set at registration."
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Avatar name={user.fullName} photo={user.photo} size={112} />
            <div>
              <p className="font-semibold">{user.fullName}</p>
              <p className="text-sm text-muted-foreground">{user.rollNumber}</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={update.isPending && update.variables?.photo !== undefined}
                onClick={() => fileRef.current?.click()}
              >
                <Camera /> {user.photo ? 'Change' : 'Upload'} photo
              </Button>
              {user.photo && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Remove photo"
                  onClick={() => update.mutate({ photo: null })}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG or WEBP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <form
              className="grid gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setErrors({});
                setMsg(null);
                if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile))
                  return setErrors({ mobile: 'Enter a valid 10-digit mobile number' });
                update.mutate(
                  { fullName: f.fullName, mobile: f.mobile },
                  {
                    onSuccess: () => setMsg({ tone: 'success', text: 'Profile saved.' }),
                    onError: onErr,
                  },
                );
              }}
            >
              <Alert tone={msg?.tone}>{msg?.text}</Alert>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="fullName" label="Full name" error={errors.fullName}>
                  <Input
                    value={f.fullName}
                    onChange={(e) => setF({ ...f, fullName: e.target.value })}
                  />
                </Field>
                <Field id="mobile" label="Mobile number" error={errors.mobile} hint="Optional">
                  <Input
                    inputMode="numeric"
                    maxLength={10}
                    value={f.mobile}
                    onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '') })}
                  />
                </Field>
                <ReadOnly label="Email" value={user.email} />
                <ReadOnly label="Roll number" value={user.rollNumber} />
                <ReadOnly label="College" value={college?.name ?? '-'} />
                <ReadOnly
                  label="Department / year"
                  value={`${user.department}, year ${user.yearOfStudy}`}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!changed}
                  loading={update.isPending && update.variables?.photo === undefined}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
