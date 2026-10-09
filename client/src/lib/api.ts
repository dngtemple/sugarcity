import axios from 'axios';

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

const api = axios.create({
  baseURL: API_URL,
  // The API sleeps on its free tier and can take up to a minute to wake.
  timeout: 60_000,
});

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const e = err as { response?: { data?: { message?: string } }; code?: string };
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ECONNABORTED' || e?.code === 'ERR_NETWORK' || e?.code === 'ETIMEDOUT') {
    return 'We couldn’t reach Sugar City. Check your connection and try again.';
  }
  return fallback;
}

/** Wakes the API before it's needed, so placing an order is quick. */
export function warmUpApi() {
  fetch(`${API_URL}/health`).catch(() => {});
}

export default api;
