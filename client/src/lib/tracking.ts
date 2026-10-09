import { safeStorage } from './utils';

export type TrackStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';

export interface TrackedOrder {
  orderNumber: string;
  firstName: string;
  orderType: 'pickup' | 'delivery';
  date: string;
  time: string;
  items: { name: string; quantity: number; options: string[] }[];
  totalAmount: number;
  status: TrackStatus;
  paid: boolean;
  placedAt: string;
  history: { status: TrackStatus; at: string }[];
}

type Step = Exclude<TrackStatus, 'cancelled'>;

export const TRACK_STEPS: Step[] = ['pending', 'confirmed', 'ready', 'delivered'];

export function stepCopy(step: Step, pickup: boolean) {
  switch (step) {
    case 'pending':
      return { label: 'Received', detail: 'Your order is in. We’ll confirm it shortly.' };
    case 'confirmed':
      return { label: 'Confirmed', detail: 'It’s on the baking list.' };
    case 'ready':
      return pickup
        ? { label: 'Ready', detail: 'Boxed up and waiting for you.' }
        : { label: 'On its way', detail: 'Boxed up and heading out.' };
    case 'delivered':
      return pickup ? { label: 'Collected', detail: 'Picked up. Enjoy every bite!' } : { label: 'Delivered', detail: 'Delivered. Enjoy every bite!' };
  }
}

export function statusHeadline(status: TrackStatus, pickup: boolean) {
  switch (status) {
    case 'pending':
      return { title: 'We’ve got your order', sub: 'We’ll confirm it soon, usually on WhatsApp.' };
    case 'confirmed':
      return { title: 'Your treats are in the oven', sub: 'Confirmed and being made with care.' };
    case 'ready':
      return pickup
        ? { title: 'Your treats are ready!', sub: 'Come and collect them whenever you’re set.' }
        : { title: 'Your treats are on the way!', sub: 'Keep your phone close for the rider.' };
    case 'delivered':
      return pickup
        ? { title: 'Collected. Enjoy!', sub: 'Thanks for choosing Sugar City.' }
        : { title: 'Delivered. Enjoy!', sub: 'Thanks for choosing Sugar City.' };
    case 'cancelled':
      return { title: 'This order was cancelled', sub: 'Message us on WhatsApp if that’s a surprise.' };
  }
}

/** Order snapshot saved on this device, enough to show the confirmation again and to track it. */
export interface SavedOrder {
  orderNumber: string;
  phone: string;
  customerName: string;
  orderType: 'pickup' | 'delivery';
  date: string;
  time: string;
  address: string;
  landmark: string;
  total: number;
  lines: { name: string; quantity: number; unitPrice: number; options: { group: string; name: string }[]; message: string; section: string }[];
  gift?: { recipientName: string; recipientPhone: string; message: string };
  notes: string;
  placedAt: string;
}

const KEY = 'sc-orders';
const MAX = 10;

export function savedOrders(): SavedOrder[] {
  const list = safeStorage.get<SavedOrder[]>(KEY);
  return Array.isArray(list) ? list.filter((o) => o && typeof o.orderNumber === 'string') : [];
}

export function saveOrder(order: SavedOrder) {
  const rest = savedOrders().filter((o) => o.orderNumber !== order.orderNumber);
  safeStorage.set(KEY, [order, ...rest].slice(0, MAX));
}

export function findSavedOrder(number: string) {
  const n = number.toUpperCase();
  return savedOrders().find((o) => o.orderNumber.toUpperCase() === n);
}

/** "sc 12", "SC-12", "12" → "SC-12". */
export function normaliseOrderNumber(input: string) {
  const digits = input.replace(/\D/g, '');
  return digits ? `SC-${digits}` : input.trim().toUpperCase();
}

export function trackingLink(orderNumber: string) {
  return `${window.location.origin}/track/${encodeURIComponent(orderNumber)}`;
}
