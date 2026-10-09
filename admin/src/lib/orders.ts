import api from './api';
import { cachedGet } from './cache';
import { collectionLabel } from './menu';
import { dateKey, daysFromToday, formatDay, orderDateKey } from './utils';

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid';

export interface OrderLine {
  menuItemId?: string;
  name: string;
  section?: string;
  category?: string;
  price: number;
  quantity: number;
  options?: { group: string; name: string; price: number }[];
  message?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: 'pickup' | 'delivery';
  items: OrderLine[];
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryLocation?: string;
  landmark?: string;
  notes?: string;
  gift?: { recipientName: string; recipientPhone?: string; message?: string } | null;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus?: PaymentStatus;
  paidAt?: string | null;
  isWalkIn?: boolean;
  statusHistory?: { status: OrderStatus; timestamp: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Totals {
  orders: number;
  /** Paid orders only. */
  sales: number;
  unpaid: number;
  items: number;
}

export interface OrderSummary {
  counts: Record<OrderStatus, number>;
  dueToday: number;
  today: Totals;
}

export interface OrderPage {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  hasMore?: boolean;
}

export interface Board {
  pending: Order[];
  confirmed: Order[];
  ready: Order[];
}

export interface SalesReport extends OrderPage {
  totals: Totals;
  bySection?: { section: string; amount: number; items: number }[];
}

export const STATUSES: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'New' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'ready', label: 'Ready' },
  { status: 'delivered', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
];

export const isStatus = (v: unknown): v is OrderStatus => STATUSES.some((s) => s.status === v);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  ready: 'Ready',
  delivered: 'Completed',
  cancelled: 'Cancelled',
};

/** Pill colours per status (Tailwind classes on the brand tokens). */
export const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-cherry-50 text-cherry-700 ring-cherry/25',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-700/20',
  ready: 'bg-honey-50 text-honey-700 ring-honey-200',
  delivered: 'bg-mint-50 text-mint-700 ring-mint/20',
  cancelled: 'bg-cream-deep text-cocoa-soft ring-crumb-strong',
};

export const orderType = (o: Pick<Order, 'orderType' | 'deliveryLocation'>): 'pickup' | 'delivery' =>
  o.orderType ?? (o.deliveryLocation ? 'delivery' : 'pickup');

export const customerName = (o: Pick<Order, 'customerName'>) => o.customerName?.trim() || 'Walk-in customer';

/** The one forward move from a status, worded for the order. */
export function nextStep(o: Pick<Order, 'status' | 'orderType' | 'deliveryLocation'>): { status: OrderStatus; label: string; short: string; done: string } | null {
  switch (o.status) {
    case 'pending':
      return { status: 'confirmed', label: 'Confirm order', short: 'Confirm', done: 'confirmed' };
    case 'confirmed':
      return { status: 'ready', label: 'Mark ready', short: 'Mark ready', done: 'marked ready' };
    case 'ready':
      return orderType(o) === 'delivery'
        ? { status: 'delivered', label: 'Mark delivered', short: 'Delivered', done: 'marked delivered' }
        : { status: 'delivered', label: 'Mark collected', short: 'Collected', done: 'marked collected' };
    default:
      return null;
  }
}

export type Due = { tone: 'overdue' | 'today' | 'tomorrow' | 'later' | 'none'; label: string };

/** "Overdue · Mon 6 Oct", "Today 2:00 PM", "Tomorrow", "Fri 10 Oct 9:00 AM". */
export function dueOf(o: Pick<Order, 'deliveryDate' | 'deliveryTime' | 'status'>): Due {
  const key = orderDateKey(o.deliveryDate);
  if (!key) return { tone: 'none', label: 'No date' };
  const diff = daysFromToday(key);
  const time = o.deliveryTime && o.deliveryTime !== 'Any time' ? ` ${o.deliveryTime}` : '';
  const finished = o.status === 'delivered' || o.status === 'cancelled';
  if (diff < 0 && !finished) return { tone: 'overdue', label: `Overdue · ${formatDay(key)}` };
  if (diff === 0) return { tone: 'today', label: `Today${time}` };
  if (diff === 1) return { tone: 'tomorrow', label: `Tomorrow${time}` };
  return { tone: 'later', label: `${formatDay(key)}${time}` };
}

/** The time slot heading an order sits under; anything without a set hour is "Any time". */
export const slotLabel = (time?: string | null) => (time && time.trim() && time !== 'Any time' ? time.trim() : 'Any time');

export const isDueToday =(o: Pick<Order, 'deliveryDate'>) => orderDateKey(o.deliveryDate) === dateKey();

export const itemCount = (o: Pick<Order, 'items'>) => o.items.reduce((n, l) => n + (l.quantity || 0), 0);

const COLLECTION_ORDER = ['cakes', 'pastries', 'gifts', 'other'];
const lineCollection = (l: OrderLine) => l.section || (l.category === 'Custom' || !l.menuItemId ? 'other' : 'cakes');

/** Lines grouped Cakes → Pastries → Gifts → Other. */
export function linesByCollection(lines: OrderLine[]) {
  const groups = new Map<string, OrderLine[]>();
  for (const line of lines) {
    const c = lineCollection(line);
    groups.set(c, [...(groups.get(c) ?? []), line]);
  }
  return [...groups.entries()]
    .sort((a, b) => COLLECTION_ORDER.indexOf(a[0]) - COLLECTION_ORDER.indexOf(b[0]))
    .map(([collection, items]) => ({ collection, label: collectionLabel(collection), items }));
}

/** "Flavour: Vanilla, Chocolate" rather than one row per tick. */
export function optionsByGroup(options: { group: string; name: string }[] = []) {
  const map = new Map<string, string[]>();
  for (const o of options) map.set(o.group, [...(map.get(o.group) ?? []), o.name]);
  return [...map.entries()];
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  const { data } = await api.put<Order>(`/orders/${id}/status`, { status });
  return data;
}

export async function setPayment(id: string, paymentStatus: PaymentStatus) {
  const { data } = await api.put<Order>(`/orders/${id}/payment`, { paymentStatus });
  return data;
}

/**
 * Every active order for the board. Falls back to three list calls if the
 * API doesn't have /orders/board yet.
 */
export async function fetchBoard(force = false): Promise<Board> {
  try {
    return await cachedGet<Board>('/orders/board', undefined, { force, ttl: 10_000 });
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status !== 404) throw err;
    const [pending, confirmed, ready] = await Promise.all(
      (['pending', 'confirmed', 'ready'] as const).map((status) =>
        cachedGet<OrderPage>('/orders', { params: { status, page: 1 } }, { force }).then((d) => d.orders)
      )
    );
    return { pending, confirmed, ready };
  }
}

/* -------------------------------------------------------------- sales */

export type PaymentFilter = 'all' | 'paid' | 'unpaid';
export type TypeFilter = 'all' | 'pickup' | 'delivery' | 'walkin' | 'website';
export type StatusFilter = 'active' | 'any' | OrderStatus;

export interface SalesFilters {
  from: string;
  to: string;
  payment: PaymentFilter;
  type: TypeFilter;
  status: StatusFilter;
}

export const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'Paid and unpaid' },
  { value: 'paid', label: 'Paid only' },
  { value: 'unpaid', label: 'Unpaid only' },
];

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Every order' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'walkin', label: 'Counter sales' },
  { value: 'website', label: 'Website orders' },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'All but cancelled' },
  { value: 'pending', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'any', label: 'Every status' },
];

export type Preset = 'today' | 'week' | 'month' | 'all' | 'custom';

export const PRESETS: { key: Exclude<Preset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

export function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = dateKey(now);
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: dateKey(monday), to };
  }
  if (preset === 'month') return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  return { from: '', to: '' };
}

export function presetOf(from: string, to: string): Preset {
  return PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === from && r.to === to;
  })?.key ?? 'custom';
}

export const defaultSalesFilters = (): SalesFilters => ({ ...presetRange('month'), payment: 'all', type: 'all', status: 'active' });
