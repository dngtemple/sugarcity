import type { AxiosRequestConfig } from 'axios';
import api from './api';

/**
 * A small GET cache. The API is far away, so two things matter:
 *  - moving between pages shouldn't refetch what was loaded seconds ago;
 *  - two components asking for the same URL at once should share one request.
 * After a change, call `invalidateCache(prefix)` (events.ts does this for you).
 */
interface Entry {
  data: unknown;
  at: number;
}

const store = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 30_000;

function cacheKey(url: string, params?: Record<string, unknown>) {
  if (!params) return url;
  const sorted = Object.fromEntries(
    Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== '')
      .map((k) => [k, params[k]])
  );
  return `${url}?${JSON.stringify(sorted)}`;
}

export function cachedGet<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
  opts?: { ttl?: number; force?: boolean }
): Promise<T> {
  const ttl = opts?.ttl ?? DEFAULT_TTL;
  const key = cacheKey(url, config?.params as Record<string, unknown> | undefined);

  if (!opts?.force) {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
    const inflight = pending.get(key);
    if (inflight) return inflight as Promise<T>;
  }

  const request = api
    .get<T>(url, config)
    .then((res) => {
      store.set(key, { data: res.data, at: Date.now() });
      return res.data;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

/** Forget cached responses: all of them, or those whose URL starts with `prefix`. */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
