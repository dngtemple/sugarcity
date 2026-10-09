import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const whole = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 });
const pesewas = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "GH₵ 120", or "GH₵ 120.50" when there are pesewas. */
export function formatMoney(amount: number) {
  const hasPesewas = Math.round(amount * 100) % 100 !== 0;
  return `GH₵ ${(hasPesewas ? pesewas : whole).format(amount)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as YYYY-MM-DD. */
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** "Saturday, 10 October 2026" */
export function formatDateLong(key: string) {
  return fromKey(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Sat 10 Oct" */
export function formatDateShort(key: string) {
  return fromKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today", "Tomorrow" or "Sat 10 Oct". */
export function friendlyDay(key: string) {
  const today = dateKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return formatDateShort(key);
}

/** "10 Oct, 2:15 PM" for an ISO timestamp. */
export function formatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** 14 → "2:00 PM" */
export function hourLabel(hour: number) {
  const h = hour % 24;
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${meridiem}`;
}

/** Hourly slots from openHour up to (not including) closeHour. */
export function timeSlots(openHour: number, closeHour: number) {
  const open = Math.max(0, Math.min(23, Math.floor(openHour)));
  const close = Math.max(open + 1, Math.min(24, Math.floor(closeHour)));
  const slots: { hour: number; label: string }[] = [];
  for (let h = open; h < close; h++) slots.push({ hour: h, label: hourLabel(h) });
  return slots;
}

/** Slots still bookable on a date: today's must be at least an hour away. */
export function availableSlots(date: string, openHour: number, closeHour: number) {
  const all = timeSlots(openHour, closeHour);
  if (date !== dateKey()) return all;
  const now = new Date();
  const earliest = now.getHours() + (now.getMinutes() > 0 ? 2 : 1);
  return all.filter((s) => s.hour >= earliest);
}

/** localStorage that never throws (private mode, blocked storage). */
export const safeStorage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* nothing we can do */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
