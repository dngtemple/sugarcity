import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../stores/auth';
import { errorMessage, statusOf } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      const status = statusOf(err);
      setError(
        status === 401
          ? 'That email and password don’t match. Try again?'
          : status === 403
            ? errorMessage(err, 'This account can’t sign in to the Studio.')
            : errorMessage(err, 'We couldn’t sign you in. Please try again.')
      );
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Sign in" intro="Use your Sugar City staff email.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field
          label="Password"
          htmlFor="login-password"
          aside={
            <Link to="/forgot-password" className="sc-link text-sm">
              Forgot it?
            </Link>
          }
        >
          <div className="relative">
            <Input
              id="login-password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-full text-cocoa-faint hover:text-plum"
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </Field>
        {error && (
          <p className="rounded-lg bg-berry-50 px-4 py-3 text-sm font-medium text-berry-700" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={busy}>
          Open the Studio
        </Button>
      </form>
    </AuthLayout>
  );
}
