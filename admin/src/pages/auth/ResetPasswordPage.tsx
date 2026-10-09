import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { buttonClass } from '../../components/ui/buttonStyles';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthLayout title="This link is incomplete" intro="Open the reset link from your email again, or ask for a new one.">
        <Link to="/forgot-password" className={buttonClass('primary', 'lg', 'w-full')}>
          Get a new link
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password changed">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-mint-50 text-mint">
            <KeyRound className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-cocoa-soft">You can sign in with your new password now.</p>
          <Link to="/login" className={buttonClass('primary', 'lg', 'mt-6 w-full')}>
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError('Use at least 6 characters.');
    if (password !== repeat) return setError('The two passwords don’t match.');
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, 'This link has expired or was already used. Ask for a new one.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" intro="At least 6 characters. Something only you would know.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="reset-password">
          <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Type it again" htmlFor="reset-repeat">
          <Input id="reset-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        {error && (
          <p className="rounded-lg bg-berry-50 px-4 py-3 text-sm font-medium text-berry-700" role="alert">
            {error}{' '}
            {/expired|used/i.test(error) && (
              <Link to="/forgot-password" className="sc-link">
                New link
              </Link>
            )}
          </p>
        )}
        <Button type="submit" size="lg" block loading={busy}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
