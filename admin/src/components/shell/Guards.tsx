import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/auth';

/** Signed-in staff only; everyone else goes to /login and comes back after. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!token || !user) {
    const back = location.pathname + location.search;
    return <Navigate to={back && back !== '/' ? `/login?next=${encodeURIComponent(back)}` : '/login'} replace />;
  }
  return <>{children}</>;
}

/** Sign-in page only for people who aren't signed in. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const next = new URLSearchParams(useLocation().search).get('next');
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return token && user ? <Navigate to={safe} replace /> : <>{children}</>;
}
