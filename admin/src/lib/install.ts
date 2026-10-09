import { useSyncExternalStore } from 'react';

/*
 * Home-screen install.
 * Chrome (Android, desktop) fires `beforeinstallprompt` once — often before
 * React renders — so it is caught here at import time and replayed on tap.
 * iPhone and iPad have no prompt; the Studio explains Share → Add to Home Screen.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  installed: boolean;
  canPrompt: boolean;
  ios: boolean;
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let saved: BeforeInstallPromptEvent | null = null;
let snapshot: InstallState = { installed: isStandalone(), canPrompt: false, ios: isIos() };
const subscribers = new Set<() => void>();

function patch(next: Partial<InstallState>) {
  snapshot = { ...snapshot, ...next };
  subscribers.forEach((fn) => fn());
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  saved = event as BeforeInstallPromptEvent;
  patch({ canPrompt: true });
});

window.addEventListener('appinstalled', () => {
  saved = null;
  patch({ installed: true, canPrompt: false });
});

/** Production only — in development a service worker fights hot reload. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

/** Opens the browser's own install prompt. Resolves true when installed. */
export async function promptInstall() {
  const event = saved;
  if (!event) return false;
  saved = null;
  patch({ canPrompt: false });
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === 'accepted';
}

export function useInstall() {
  const state = useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => snapshot
  );
  return { ...state, available: !state.installed && (state.canPrompt || state.ios) };
}
