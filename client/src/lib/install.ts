import { useSyncExternalStore } from 'react';

// Home-screen install for Sugar City.
//
// Android and desktop Chrome fire `beforeinstallprompt` once the page is
// installable, often before React renders, so we catch it here at
// import time and replay it when someone taps "Install". iPhones have no
// prompt: we show Share → Add to Home Screen steps instead.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** Already running from the home screen. */
  installed: boolean;
  /** The browser's own install prompt is available (Android, desktop Chrome). */
  canPrompt: boolean;
  /** iPhone / iPad, where installing is done by hand from the Share menu. */
  ios: boolean;
}

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferred: InstallPromptEvent | null = null;
let state: InstallState = { installed: standalone(), canPrompt: false, ios: isIos() };
const listeners = new Set<() => void>();

function update(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  update({ canPrompt: true });
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  update({ installed: true, canPrompt: false });
});

/** Registers the service worker. Production only: in dev it would get in the way of hot reload. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/** Shows the browser's install prompt. Resolves true if the app was installed. */
export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  update({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

export function useInstall(): InstallState & { available: boolean } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
  return { ...s, available: !s.installed && (s.canPrompt || s.ios) };
}
