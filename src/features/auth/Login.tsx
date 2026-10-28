import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { useDemoLogin, useLogin } from '@/lib/api/hooks';
import { DEMO } from '@/lib/db/seed';
import type { PublicUser } from '@/types';

export const homeFor = (u: PublicUser) => (u.role === 'admin' ? '/admin' : '/student');

export default function Login() {
  const nav = useNavigate();
  const login = useLogin();
  const demo = useDemoLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const f: Record<string, string> = {};
    if (!email.trim()) f.email = 'Enter your email';
    if (!password) f.password = 'Enter your password';
    setErrors(f);
    if (Object.keys(f).length) return;
    login.mutate({ email, password }, { onSuccess: (u) => nav(homeFor(u), { replace: true }) });
  };
  const error = login.error?.message || demo.error?.message;

  return (
    <AuthLayout title="Log in" subtitle="Students and campus managers sign in here.">
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Alert tone="error">{error}</Alert>
            <Field id="email" label="Email" error={errors.email}>
              <Input
                type="email"
                autoComplete="email"

                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field id="password" label="Password" error={errors.password}>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={login.isPending}>
              Log in
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New student?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          loading={demo.isPending && demo.variables === 'student'}
          onClick={() => demo.mutate('student', { onSuccess: (u) => nav(homeFor(u)) })}
        >
          <GraduationCap /> Demo as Student
        </Button>
        <Button
          variant="outline"
          loading={demo.isPending && demo.variables === 'admin'}
          onClick={() => demo.mutate('admin', { onSuccess: (u) => nav(homeFor(u)) })}
        >
          <ShieldCheck /> Demo as Admin
        </Button>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Demo credentials</summary>
        <ul className="mt-2 space-y-1">
          <li>
            Student: <code>{DEMO.student.email}</code> / <code>{DEMO.student.password}</code>
          </li>
          <li>
            Admin (RCE): <code>{DEMO.admin.email}</code> / <code>{DEMO.admin.password}</code>
          </li>
          <li>
            Admin (GASC + LBS): <code>{DEMO.admin2.email}</code> /{' '}
            <code>{DEMO.admin2.password}</code>
          </li>
          <li>
            Every other demo student uses <code>Student@123</code>.
          </li>
        </ul>
      </details>
    </AuthLayout>
  );
}
