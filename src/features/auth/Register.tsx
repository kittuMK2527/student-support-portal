import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useReference, useRegister } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api';

const EMPTY = {
  fullName: '',
  rollNumber: '',
  department: '',
  yearOfStudy: '',
  collegeId: '',
  email: '',
  password: '',
  confirmPassword: '',
};
type Form = typeof EMPTY;

function check(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Full name is required';
  if (!/^[A-Za-z0-9/-]{3,20}$/.test(f.rollNumber.trim()))
    e.rollNumber = f.rollNumber.trim()
      ? 'Use 3-20 letters, digits, / or -'
      : 'Roll number is required';
  if (!f.department.trim()) e.department = 'Choose your department';
  if (!f.yearOfStudy) e.yearOfStudy = 'Choose your year';
  if (!f.collegeId) e.collegeId = 'Choose your college';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()))
    e.email = f.email.trim() ? 'Enter a valid email address' : 'Email is required';
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
    e.password = 'At least 8 characters, with a letter and a number';
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match';
  return e;
}

export default function Register() {
  const nav = useNavigate();
  const ref = useReference();
  const reg = useRegister();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = check(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    reg.mutate(
      { ...f, yearOfStudy: Number(f.yearOfStudy) },
      {
        onSuccess: () => nav('/student', { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError && err.fields) setErrors(err.fields);
        },
      },
    );
  };
  const pw = f.password;
  return (
    <AuthLayout
      title="Create your student account"
      subtitle="Use the details on your college ID card."
      wide
    >
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Alert tone="error">
              {reg.error && !(reg.error instanceof ApiError && reg.error.fields)
                ? reg.error.message
                : null}
            </Alert>
            <Field id="fullName" label="Full name" error={errors.fullName}>
              <Input autoComplete="name" value={f.fullName} onChange={set('fullName')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="collegeId" label="College" error={errors.collegeId}>
                <NativeSelect
                  value={f.collegeId}
                  onChange={(e) => {
                    setF({ ...f, collegeId: e.target.value, department: '' });
                    setErrors({ ...errors, collegeId: undefined });
                  }}
                >
                  <option value="">Choose your college</option>
                  {ref.data?.colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="rollNumber" label="Roll number" error={errors.rollNumber}>
                <Input
                  autoCapitalize="characters"
                  placeholder="e.g. RCE22CS099"
                  value={f.rollNumber}
                  onChange={set('rollNumber')}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="department" label="Department" error={errors.department}>
                <NativeSelect
                  value={f.department}
                  onChange={set('department')}
                  disabled={!f.collegeId}
                >
                  <option value="">
                    {f.collegeId ? 'Choose your department' : 'Choose a college first'}
                  </option>
                  {ref.data?.departments
                    .filter((d) => d.collegeId === f.collegeId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field id="yearOfStudy" label="Year of study" error={errors.yearOfStudy}>
                <NativeSelect value={f.yearOfStudy} onChange={set('yearOfStudy')}>
                  <option value="">Choose</option>
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field id="email" label="Email" error={errors.email}>
              <Input type="email" autoComplete="email" value={f.email} onChange={set('email')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="password"
                label="Password"
                error={errors.password}
                hint={
                  <span className="flex gap-3">
                    {[
                      [pw.length >= 8, '8+ characters'],
                      [/[A-Za-z]/.test(pw), 'a letter'],
                      [/\d/.test(pw), 'a number'],
                    ].map(([ok, t]) => (
                      <span key={String(t)} className={ok ? 'text-emerald-600' : ''}>
                        {ok ? '✓' : '○'} {t}
                      </span>
                    ))}
                  </span>
                }
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={f.password}
                  onChange={set('password')}
                />
              </Field>
              <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={f.confirmPassword}
                  onChange={set('confirmPassword')}
                />
              </Field>
            </div>
            <Button type="submit" loading={reg.isPending}>
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
