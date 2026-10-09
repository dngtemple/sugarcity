import { Request, Response } from 'express';
import Order, {
  ACTIVE_STATUSES,
  IOrder,
  IOrderGift,
  ORDER_STATUSES,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PAYMENT_STATUSES,
} from '../models/Order.model';
import { nextSequence } from '../models/Counter.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendNewOrderEmail } from '../lib/mailer';
import { logAudit } from '../lib/audit';
import { priceOrderLines } from '../lib/pricing';
import { getSettings, noticeDaysFor } from './settings.controller';

const DAY_MS = 24 * 60 * 60 * 1000;

// Ghana is on GMT all year (no daylight saving), so the UTC calendar day is
// the shop's calendar day — no timezone library needed.
const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

/** Parses a YYYY-MM-DD date from a date input into midnight UTC. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || toDateKey(date) !== value ? null : date;
}

/**
 * Minutes after midnight for a slot label: "10:00 AM", "2 PM" or "14:00".
 * Null when it can't be read (e.g. "Any time" on a counter order).
 */
export function slotMinutes(label: unknown): number | null {
  if (typeof label !== 'string') return null;
  const m = label.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/i) ?? label.trim().match(/^(\d{1,2}):(\d{2})()$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const half = m[3]?.toLowerCase();
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (half === 'p' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return hour * 60 + minute;
}

/** 8 → "8:00 AM", 13 → "1:00 PM", 24 → "12:00 AM" — the labels the website shows. */
const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour % 24 < 12 ? 'AM' : 'PM'}`;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const phoneDigits = (s: string) => s.replace(/\D/g, '').length;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The counter starts at 1000, so the first order is SC-1001.
const generateOrderNumber = async () => `SC-${await nextSequence('order')}`;

interface OrderDetails {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryDate?: Date;
  deliveryTime: string;
  deliveryLocation: string;
  landmark: string;
  notes: string;
}

/**
 * Validates the customer/fulfilment part of an order. The website requires a
 * name, phone number, date and time; staff entering a counter sale may skip
 * all of them.
 */
function readOrderDetails(
  b: any,
  opts: { requireName: boolean; requirePhone: boolean; requireDate: boolean; requireTime: boolean }
): OrderDetails | { error: string } {
  const customerName = text(b.customerName, 80) || (opts.requireName ? '' : 'Walk-in customer');
  if (!customerName) return { error: 'Please enter your name.' };

  const customerPhone = text(b.customerPhone, 30);
  if (customerPhone || opts.requirePhone) {
    const digits = phoneDigits(customerPhone);
    if (digits < 9 || digits > 15) return { error: 'Please enter a valid phone number.' };
  }

  const orderType: OrderType = b.orderType === 'delivery' ? 'delivery' : 'pickup';

  let deliveryDate: Date | undefined;
  if (b.deliveryDate) {
    const parsed = parseDateOnly(b.deliveryDate);
    if (!parsed) return { error: 'Please choose a valid date.' };
    deliveryDate = parsed;
  } else if (opts.requireDate) {
    return { error: `Please choose a ${orderType} date.` };
  }

  const deliveryTime = text(b.deliveryTime, 20);
  if (!deliveryTime && opts.requireTime) return { error: `Please choose a ${orderType} time.` };

  const deliveryLocation = orderType === 'delivery' ? text(b.deliveryLocation, 200) : '';
  if (orderType === 'delivery' && !deliveryLocation) return { error: 'Please enter the delivery address.' };

  return {
    customerName,
    customerPhone,
    orderType,
    deliveryDate,
    deliveryTime,
    deliveryLocation,
    landmark: orderType === 'delivery' ? text(b.landmark, 120) : '',
    notes: text(b.notes, 500),
  };
}

/**
 * Who a gift goes to, when the customer says it's a gift. The delivery
 * address on the order is then the recipient's.
 */
function readGift(raw: unknown): IOrderGift | undefined | { error: string } {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as Record<string, unknown>;
  const recipientName = text(g.recipientName, 80);
  const recipientPhone = text(g.recipientPhone, 30);
  if (!recipientName) return { error: 'Please enter who the gift is for.' };
  const digits = phoneDigits(recipientPhone);
  if (digits < 9 || digits > 15) return { error: 'Please enter a valid phone number for the person receiving the gift.' };
  return { recipientName, recipientPhone, message: text(g.message, 200) };
}

const confirmationOf = (order: Pick<IOrder, 'orderNumber' | 'totalAmount' | 'items'>) => ({
  orderNumber: order.orderNumber,
  totalAmount: order.totalAmount,
  items: order.items,
});

/** Public checkout from the website. No account needed. */
export const createOrder = async (req: Request, res: Response, next: any) => {
  try {
    const b = req.body ?? {};
    const details = readOrderDetails(b, { requireName: true, requirePhone: true, requireDate: true, requireTime: true });
    if ('error' in details) { res.status(400).json({ message: details.error }); return; }
    const gift = readGift(b.gift);
    if (gift && 'error' in gift) { res.status(400).json({ message: gift.error }); return; }

    const clientRef =
      typeof b.clientRef === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(b.clientRef) ? b.clientRef : undefined;

    const [settings, priced, alreadyPlaced] = await Promise.all([
      getSettings(),
      priceOrderLines(b.items, { allowCustom: false, allowUnavailable: false, enforceMinimum: true }),
      clientRef ? Order.findOne({ clientRef }).lean() : null,
    ]);
    // Same checkout submitted twice (e.g. a retry after a slow network): hand
    // back the order that already went through instead of a duplicate.
    if (alreadyPlaced) { res.json(confirmationOf(alreadyPlaced)); return; }
    if ('error' in priced) { res.status(400).json({ message: priced.error }); return; }

    const noticeDays = noticeDaysFor(settings, priced.sections);
    const today = startOfTodayUtc();
    const earliest = new Date(today.getTime() + noticeDays * DAY_MS);
    if (details.deliveryDate! < earliest) {
      const when = noticeDays === 0
        ? 'today'
        : earliest.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
      res.status(400).json({ message: `The earliest date we can bake this for is ${when}.` });
      return;
    }

    // The time must be one of the day's slots: on the hour, from opening
    // until the last slot an hour before closing.
    const minutes = slotMinutes(details.deliveryTime);
    const { openHour, closeHour } = settings;
    if (minutes === null || minutes < openHour * 60 || minutes > (closeHour - 1) * 60) {
      res.status(400).json({
        message: `Please choose a time between ${hourLabel(openHour)} and ${hourLabel(closeHour - 1)}.`,
      });
      return;
    }
    // A slot later today must still be ahead of us. The website asks for an
    // hour's lead time; the server only refuses times already gone, so a
    // customer who took a while at checkout isn't turned away.
    if (details.deliveryDate!.getTime() === today.getTime()) {
      const now = new Date();
      if (minutes <= now.getUTCHours() * 60 + now.getUTCMinutes()) {
        res.status(400).json({ message: 'That time has already passed today. Please choose a later time.' });
        return;
      }
    }

    let order;
    try {
      order = await Order.create({
        orderNumber: await generateOrderNumber(),
        clientRef,
        ...details,
        gift,
        items: priced.items,
        totalAmount: priced.total,
        isWalkIn: false,
        statusHistory: [{ status: 'pending', timestamp: new Date() }],
      });
    } catch (err: any) {
      // Two identical submits racing each other past the check above.
      if (err?.code === 11000 && clientRef) {
        const existing = await Order.findOne({ clientRef }).lean();
        if (existing) { res.json(confirmationOf(existing)); return; }
      }
      throw err;
    }

    res.status(201).json(confirmationOf(order));

    sendNewOrderEmail(order).catch((err) => console.error('[Mailer] Failed to send order email:', err));
  } catch (err) { next(err); }
};

/** "sc 123", "SC-123" or just "123" → "SC-123". */
function normaliseOrderNumber(value: unknown) {
  const digits = typeof value === 'string' ? value.trim().match(/^(?:sc)?[\s-]*(\d{1,9})$/i)?.[1] : undefined;
  return digits ? `SC-${Number(digits)}` : null;
}

/** Last 9 digits, so 024 123 4567 and +233 24 123 4567 match. */
const phoneKey = (s: string) => s.replace(/\D/g, '').slice(-9);

/**
 * Public order tracking. Order numbers count up, so the number alone would
 * let anyone read other people's orders — the phone it was placed with has to
 * match too. Only what the customer needs to see is returned: no address,
 * notes or gift details.
 */
export const trackOrder = async (req: Request, res: Response, next: any) => {
  try {
    const orderNumber = normaliseOrderNumber(req.query.number);
    const phone = typeof req.query.phone === 'string' ? phoneKey(req.query.phone) : '';
    const notFound = () => res.status(404).json({ message: 'We couldn’t find an order with that number and phone number.' });
    if (!orderNumber || phone.length < 9) { notFound(); return; }

    const order = await Order.findOne({ orderNumber })
      .select('orderNumber customerName customerPhone orderType deliveryDate deliveryTime items.name items.quantity items.options totalAmount status paymentStatus statusHistory createdAt')
      .lean();
    if (!order || phoneKey(order.customerPhone) !== phone) { notFound(); return; }

    res.json({
      orderNumber: order.orderNumber,
      firstName: order.customerName.split(/\s+/)[0] ?? '',
      orderType: order.orderType,
      date: order.deliveryDate ? toDateKey(order.deliveryDate) : '',
      time: order.deliveryTime,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, options: i.options.map((o) => o.name) })),
      totalAmount: order.totalAmount,
      status: order.status,
      paid: order.paymentStatus === 'paid',
      placedAt: order.createdAt,
      history: order.statusHistory.map((h) => ({ status: h.status, at: h.timestamp })),
    });
  } catch (err) { next(err); }
};

/** Counter / phone order entered by staff. May include off-menu items. */
export const createWalkinOrder = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const b = req.body ?? {};
    const details = readOrderDetails(b, { requireName: false, requirePhone: false, requireDate: false, requireTime: false });
    if ('error' in details) { res.status(400).json({ message: details.error }); return; }

    const priced = await priceOrderLines(b.items, { allowCustom: true, allowUnavailable: true, enforceMinimum: false });
    if ('error' in priced) { res.status(400).json({ message: priced.error }); return; }

    const paid = b.paid === true;
    const completed = b.completed === true;
    const now = new Date();

    const order = await Order.create({
      orderNumber: await generateOrderNumber(),
      ...details,
      deliveryDate: details.deliveryDate ?? startOfTodayUtc(),
      items: priced.items,
      totalAmount: priced.total,
      isWalkIn: true,
      status: completed ? 'delivered' : 'pending',
      paymentStatus: paid ? 'paid' : 'unpaid',
      paidAt: paid ? now : null,
      statusHistory: completed
        ? [{ status: 'pending', timestamp: now }, { status: 'delivered', timestamp: now }]
        : [{ status: 'pending', timestamp: now }],
    });

    logAudit({ actorId: req.user?.id, action: 'order.created_walkin', entity: 'order', entityId: order.id, meta: { orderNumber: order.orderNumber, total: order.totalAmount } });
    res.status(201).json(order);
  } catch (err) { next(err); }
};

const PAGE_SIZE = 20;

// Kitchen-friendly ordering per tab: new orders newest first, work in
// progress by when it is due, finished orders most recently touched first.
const SORT_BY_STATUS: Record<OrderStatus, Record<string, 1 | -1>> = {
  pending: { createdAt: -1 },
  confirmed: { deliveryDate: 1, createdAt: 1 },
  ready: { deliveryDate: 1, createdAt: 1 },
  delivered: { updatedAt: -1 },
  cancelled: { updatedAt: -1 },
};

export const listOrders = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const status = String(req.query.status || 'pending');
    const search = text(req.query.search, 60);
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const query: Record<string, any> = {};
    let sort: Record<string, 1 | -1> = { createdAt: -1 };

    if (search) {
      // A search looks across every status. Phone numbers match regardless of
      // spacing ("024 400" finds "0244001234").
      const digits = search.replace(/\D/g, '');
      const isPhoneLike = digits.length >= 3 && /^[\d\s+()-]+$/.test(search);
      const pattern = isPhoneLike ? digits.split('').join('\\D*') : escapeRegex(search);
      const re = { $regex: pattern, $options: 'i' };
      query.$or = [
        { orderNumber: re }, { customerName: re }, { customerPhone: re },
        { 'gift.recipientName': re }, { 'gift.recipientPhone': re },
      ];
    } else {
      if (!ORDER_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({ message: 'Unknown status' });
        return;
      }
      query.status = status;
      sort = SORT_BY_STATUS[status as OrderStatus];
    }

    // Numbered pages need the matching total as well as the rows. A $facet
    // gets both in one round-trip, instead of a second countDocuments call.
    const [facet] = await Order.aggregate([
      { $match: query },
      {
        $facet: {
          rows: [{ $sort: sort }, { $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const total = facet.total[0]?.count ?? 0;
    res.json({ orders: facet.rows, total, page, pageSize: PAGE_SIZE, hasMore: page * PAGE_SIZE < total });
  } catch (err) { next(err); }
};

// What an order card on the board shows — the full order loads when a card
// is opened, so the address, notes and option prices stay behind.
const BOARD_FIELDS = [
  'orderNumber', 'customerName', 'customerPhone', 'orderType', 'deliveryDate', 'deliveryTime',
  'status', 'totalAmount', 'paymentStatus', 'isWalkIn', 'createdAt', 'updatedAt',
  'items.name', 'items.quantity', 'items.section', 'items.options.name', 'gift.recipientName',
].join(' ');

type BoardOrder = Pick<IOrder, 'status' | 'deliveryDate' | 'deliveryTime' | 'createdAt'>;

/** Due first: by date, then time of day, then whoever ordered earlier. Undated last. */
const byDue = (a: BoardOrder, b: BoardOrder) => {
  const da = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
  const db = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
  if (da !== db) return da - db;
  const ta = slotMinutes(a.deliveryTime) ?? 24 * 60;
  const tb = slotMinutes(b.deliveryTime) ?? 24 * 60;
  if (ta !== tb) return ta - tb;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

/**
 * Every order still being worked on, split into the board's three columns.
 * One query; the split and the due-time sort happen here because slot labels
 * ("2:00 PM") don't sort as text.
 */
export const getOrderBoard = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const orders = await Order.find({ status: { $in: ACTIVE_STATUSES } })
      .select(BOARD_FIELDS)
      .sort({ createdAt: -1 })
      .lean<BoardOrder[]>();

    const column = (s: OrderStatus) => orders.filter((o) => o.status === s);
    res.json({
      // Already newest first from the query.
      pending: column('pending'),
      confirmed: column('confirmed').sort(byDue),
      ready: column('ready').sort(byDue),
    });
  } catch (err) { next(err); }
};

const IS_PAID = { $eq: ['$paymentStatus', 'paid'] };

/**
 * What a set of orders is worth. `sales` is money actually taken — an order
 * only counts once it is marked paid — and `unpaid` is what is still owed on
 * the rest.
 */
const SALES_SUMS = {
  sales: { $sum: { $cond: [IS_PAID, '$totalAmount', 0] } },
  unpaid: { $sum: { $cond: [{ $not: [IS_PAID] }, '$totalAmount', 0] } },
  orders: { $sum: 1 },
  items: { $sum: { $sum: '$items.quantity' } },
};

const salesTotals = (rows: any[]) => {
  const t = rows[0] ?? {};
  return { sales: t.sales ?? 0, unpaid: t.unpaid ?? 0, orders: t.orders ?? 0, items: t.items ?? 0 };
};

/** Tab counts, what's due today and today's takings — one round-trip. */
export const getOrderSummary = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const start = startOfTodayUtc();
    const end = new Date(start.getTime() + DAY_MS);

    const [facet] = await Order.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          placedToday: [
            { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' } } },
            { $group: { _id: null, ...SALES_SUMS } },
          ],
          dueToday: [
            { $match: { deliveryDate: { $gte: start, $lt: end }, status: { $in: ACTIVE_STATUSES } } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const count = (s: OrderStatus) => facet.byStatus.find((b: any) => b._id === s)?.count ?? 0;
    res.json({
      counts: {
        pending: count('pending'),
        confirmed: count('confirmed'),
        ready: count('ready'),
        delivered: count('delivered'),
        cancelled: count('cancelled'),
      },
      dueToday: facet.dueToday[0]?.count ?? 0,
      today: salesTotals(facet.placedToday),
    });
  } catch (err) { next(err); }
};

/**
 * The filter behind the sales report. Dates are inclusive calendar days and
 * run on when the order was placed; "active" — the default — leaves out
 * cancelled orders, since they are not sales.
 */
function salesFilter(q: any): Record<string, any> | { error: string } {
  const filter: Record<string, any> = {};

  const from = q.from ? parseDateOnly(q.from) : null;
  const to = q.to ? parseDateOnly(q.to) : null;
  if (q.from && !from) return { error: 'Please choose a valid start date.' };
  if (q.to && !to) return { error: 'Please choose a valid end date.' };
  if (from && to && to < from) return { error: 'The end date comes before the start date.' };
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: new Date(to.getTime() + DAY_MS) } : {}),
    };
  }

  const payment = String(q.payment || 'all');
  if (payment === 'paid') filter.paymentStatus = 'paid';
  else if (payment === 'unpaid') filter.paymentStatus = { $ne: 'paid' };
  else if (payment !== 'all') return { error: 'Unknown payment filter' };

  // A counter sale is a pickup as far as `orderType` goes, so "walk-in" is
  // its own choice rather than a third order type.
  const type = String(q.type || 'all');
  if (type === 'walkin') filter.isWalkIn = true;
  else if (type === 'website') filter.isWalkIn = { $ne: true };
  else if (type === 'pickup' || type === 'delivery') filter.orderType = type;
  else if (type !== 'all') return { error: 'Unknown order type' };

  const status = String(q.status || 'active');
  if (status === 'active') filter.status = { $ne: 'cancelled' };
  else if (ORDER_STATUSES.includes(status as OrderStatus)) filter.status = status;
  else if (status !== 'any') return { error: 'Unknown status' };

  return filter;
}

/** Sales report: totals and the orders behind them, filtered and paged. */
export const getSalesReport = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const filter = salesFilter(req.query ?? {});
    if ('error' in filter) { res.status(400).json({ message: filter.error }); return; }
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));

    // Totals cover the whole filter, the rows only this page — one pass over
    // the matched orders gives both.
    const [facet] = await Order.aggregate([
      { $match: filter },
      {
        $facet: {
          rows: [{ $sort: { createdAt: -1 } }, { $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
          totals: [{ $group: { _id: null, ...SALES_SUMS } }],
          // Value of the lines per section. Off-menu counter items have no
          // section and are reported as "other".
          bySection: [
            { $unwind: '$items' },
            {
              $group: {
                _id: {
                  $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$items.section', ''] } }, 0] }, '$items.section', 'other'],
                },
                amount: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                items: { $sum: '$items.quantity' },
              },
            },
            { $sort: { amount: -1 } },
          ],
        },
      },
    ]);

    const totals = salesTotals(facet.totals);
    const bySection = facet.bySection.map((s: any) => ({ section: s._id, amount: s.amount, items: s.items }));
    res.json({ orders: facet.rows, totals, bySection, page, pageSize: PAGE_SIZE, total: totals.orders });
  } catch (err) { next(err); }
};

export const getOrderById = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }
    res.json(order);
  } catch (err) { next(err); }
};

// Any status can be set, including moving back a step: the admin offers one
// "next step" button plus an Undo, and every change is kept in statusHistory
// and the audit log.
export const updateOrderStatus = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const nextStatus = req.body?.status as OrderStatus;
    if (!ORDER_STATUSES.includes(nextStatus)) {
      res.status(400).json({ message: 'Unknown status' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

    const previousStatus = order.status;
    if (previousStatus !== nextStatus) {
      order.status = nextStatus;
      order.statusHistory.push({ status: nextStatus, timestamp: new Date() });
      await order.save();
      logAudit({
        actorId: req.user?.id,
        action: 'order.status_changed',
        entity: 'order',
        entityId: order.id,
        meta: { orderNumber: order.orderNumber, from: previousStatus, to: nextStatus },
      });
    }
    res.json(order.toObject());
  } catch (err) { next(err); }
};

export const updateOrderPayment = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const nextStatus = req.body?.paymentStatus as PaymentStatus;
    if (!PAYMENT_STATUSES.includes(nextStatus)) {
      res.status(400).json({ message: `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}` });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) { res.status(404).json({ message: 'Order not found' }); return; }

    const previousStatus = order.paymentStatus ?? 'unpaid';
    order.paymentStatus = nextStatus;
    order.paidAt = nextStatus === 'paid' ? new Date() : null;
    await order.save();

    logAudit({
      actorId: req.user?.id,
      action: 'order.payment_updated',
      entity: 'order',
      entityId: order.id,
      meta: { orderNumber: order.orderNumber, from: previousStatus, to: nextStatus, total: order.totalAmount },
    });
    res.json(order.toObject());
  } catch (err) { next(err); }
};
