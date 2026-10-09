import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { useBlocker } from 'react-router-dom';

/** The value, `delay` ms after it stops changing. */
export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    },
    () => window.matchMedia(query).matches
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/**
 * Runs `fn` now, every `ms` while the tab is visible, and again when the tab
 * comes back into view.
 */
export function useVisiblePoll(fn: () => void, ms = 60_000) {
  const run = useEffectEvent(fn);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') run();
    };
    const timer = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
}

/**
 * Guards unsaved work: blocks in-app navigation (show a dialog from
 * `blocker`) and warns before the tab closes. Call `allowNext()` right before
 * navigating away on purpose, e.g. after saving.
 */
export function useUnsavedGuard(dirty: boolean) {
  const bypass = useRef(false);
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string; search: string }; nextLocation: { pathname: string; search: string } }) =>
        !bypass.current && dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
      [dirty]
    )
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const allowNext = useCallback(() => {
    bypass.current = true;
    // Back on once the navigation has happened.
    window.setTimeout(() => {
      bypass.current = false;
    }, 0);
  }, []);

  return { blocker, allowNext };
}
