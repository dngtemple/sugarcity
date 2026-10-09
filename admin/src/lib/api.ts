import axios from 'axios';

/** Where the bearer token lives, outside React, so axios can read it on every request. */
export const TOKEN_KEY = 'sc-admin-token';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

const api = axios.create({
  baseURL: API_URL,
  // Generous: a free-tier API can take most of a minute to wake up.
  timeout: 60_000,
});

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let redirecting = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    // A wrong password on /auth/login is a 401 too; that one is handled by the form.
    if (err.response?.status === 401 && !url.includes('/auth/') && !redirecting) {
      redirecting = true;
      writeToken(null);
      try {
        localStorage.removeItem('sc-admin-auth');
      } catch {
        // ignore
      }
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;

/** A sentence a person can act on, from any axios error. */
export function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string } }; code?: string };
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ECONNABORTED' || e?.code === 'ERR_NETWORK') {
    return 'We couldn’t reach Sugar City. Check the connection and try again.';
  }
  return fallback;
}

export const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status;
