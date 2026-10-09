import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { buttonClass } from '../../components/ui/buttonStyles';
import { Field, Input } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the email you sign in with.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-mint-50 text-mint">
            <MailCheck className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-cocoa-soft">
            If <strong className="text-cocoa">{email.trim()}</strong> has a Studio account, a reset link is on its way. It works for 60 minutes.
          </p>
          <Link to="/login" className={buttonClass('outline', 'md', 'mt-6 w-full')}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" intro="We’ll email you a link to choose a new one.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="forgot-email" error={error}>
          <Input id="forgot-email" type="email" autoComplete="username" value={email} invalid={!!error} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" size="lg" block loading={busy}>
          Send reset link
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="sc-link inline-flex min-h-11 items-center">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
