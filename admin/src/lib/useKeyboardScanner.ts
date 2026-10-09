import { useEffect, useEffectEvent } from 'react';

/** A scanner "types" a whole code in a few milliseconds; people can't. */
const MAX_GAP_MS = 50;
const MIN_LENGTH = 4;

/**
 * Codes from a USB or Bluetooth barcode scanner, which behaves like a keyboard
 * typing the code and pressing Enter. Ignored while focus is in a field, so it
 * never steals normal typing.
 */
export function useKeyboardScanner(onScan: (code: string) => void, enabled = true) {
  const emit = useEffectEvent(onScan);

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let lastAt = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

      const now = performance.now();
      if (now - lastAt > MAX_GAP_MS) buffer = '';
      lastAt = now;

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_LENGTH) {
          e.preventDefault();
          emit(buffer);
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
