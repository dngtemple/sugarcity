import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ----------------------------------------------------------------- money */

const whole = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 });
const pesewas = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "GH₵ 1,150", or "GH₵ 1,150.50" when there are pesewas. */
export function formatMoney(amount: number | null | undefined) {
  const n = Number(amount) || 0;
  const hasPesewas = Math.round(Math.abs(n) * 100) % 100 !== 0;
  return `${n < 0 ? '−' : ''}GH₵ ${(hasPesewas ? pesewas : whole).format(Math.abs(n))}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ----------------------------------------------------------------- dates */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in local time. Ghana is on GMT all year, so local = UTC there. */
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key: string, days: number) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Order dates are stored as midnight UTC of the chosen day. */
export const orderDateKey = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

/** Whole days from today to `key` (negative = in the past). */
export function daysFromToday(key: string) {
  return Math.round((fromKey(key).getTime() - fromKey(dateKey()).getTime()) / 86_400_000);
}

/** Today / Tomorrow / Yesterday / "Fri 18 Sep" (+ year when not this year). */
export function formatDay(key: string) {
  if (!key) return '';
  const diff = daysFromToday(key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const date = fromKey(key);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "8 Oct, 2:14 pm" */
export function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "2:14 pm" today, otherwise "8 Oct, 2:14 pm". */
export function formatWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (dateKey(d) === dateKey()) return `Today, ${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`;
  return formatDateTime(iso);
}

/** "5 min ago", "3 h ago", or a date. */
export function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(iso);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ----------------------------------------------------------- time slots */

/** 14 → "2:00 PM" (the wording customers pick on the website). */
export function hourLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

/** Hourly slots from the first (openHour) to the last (closeHour − 1). */
export function timeSlots(openHour = 8, closeHour = 19) {
  const out: string[] = [];
  for (let h = openHour; h < closeHour; h++) out.push(hourLabel(h));
  return out;
}

/** "2:00 PM" → minutes after midnight; anything else (e.g. "Any time") → null. */
export function slotMinutes(label?: string | null) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec((label ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

/* ----------------------------------------------------------- phones */

/** Ghana numbers (024…, +233…) in the digits-only form wa.me wants. */
export function toWhatsAppNumber(phone: string) {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(phone: string, text?: string) {
  return `https://wa.me/${toWhatsAppNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** 233277169914 → "027 716 9914", how numbers are written in Ghana. */
export function localNumber(n: string) {
  const digits = (n ?? '').replace(/\D/g, '');
  return /^233\d{9}$/.test(digits) ? `0${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` : n ?? '';
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || '';

/* ----------------------------------------------------------- storage */

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full — only a convenience is lost.
  }
}

/* ----------------------------------------------------------- dialogs */

/** Clicking a toast (its Undo button, say) must never close the dialog under it. */
export function keepOpenForToasts(e: Event) {
  if ((e.target as Element | null)?.closest?.('.app-toaster')) e.preventDefault();
}
