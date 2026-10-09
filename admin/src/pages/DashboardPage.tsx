import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, CalendarClock, CakeSlice, Check, PackagePlus, ShoppingBasket, Wallet, Warehouse } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { onOrdersChanged } from '../lib/events';
import { useVisiblePoll } from '../lib/hooks';
import { useLowStockCount, useOrderSummary } from '../lib/useCounts';
import { customerName, fetchBoard, isDueToday, itemCount, slotLabel, type Board, type Order } from '../lib/orders';
import { cn, firstName, formatLongDate, formatMoney, greeting, plural, slotMinutes, timeAgo } from '../lib/utils';
import { Card, CardTitle, Empty, Skeleton } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { StatusPill, TypeIcon } from '../components/orders/OrderBits';
import { changeStatus } from '../components/orders/statusChange';

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const { summary } = useOrderSummary();
  const lowStock = useLowStockCount();
  const [board, setBoard] = useState<Board | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(
    (force = false) =>
      fetchBoard(force)
        .then((b) => {
          setBoard(b);
          setBoardError(false);
        })
        .catch(() => setBoardError(true)),
    []
  );

  useEffect(() => {
    void load();
    return onOrdersChanged(() => void load(true));
  }, [load]);
  useVisiblePoll(() => void load(true), 60_000);

  const schedule = useMemo(() => {
    if (!board) return [];
    const today = [...board.pending, ...board.confirmed, ...board.ready].filter(isDueToday);
    const slots = new Map<string, Order[]>();
    for (const o of today) {
      const key = slotLabel(o.deliveryTime);
      slots.set(key, [...(slots.get(key) ?? []), o]);
    }
    return [...slots.entries()].sort((a, b) => (slotMinutes(a[0]) ?? 9999) - (slotMinutes(b[0]) ?? 9999));
  }, [board]);

  const waiting = board?.pending.slice(0, 6) ?? [];

  const confirm = async (order: Order) => {
    setConfirming(order._id);
    try {
      await changeStatus(order, 'confirmed', { done: 'confirmed' });
    } catch {
      // toast shown
    } finally {
      setConfirming(null);
    }
  };

  const takings = summary?.today.sales ?? 0;
  const unpaid = summary?.today.unpaid ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="relative overflow-hidden rounded-2xl bg-plum px-5 py-6 text-cream shadow-lift sm:px-8 sm:py-8">
        <div aria-hidden className="absolute inset-0 bg-sprinkles opacity-60" />
        <div aria-hidden className="absolute -right-10 -top-16 size-56 rounded-full bg-peach/25 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-peach">{formatLongDate()}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            {greeting()}, {firstName(user?.name) || 'baker'}
          </h1>
          <p className="mt-2 max-w-xl text-cream/80">
            {summary
              ? summary.counts.pending > 0
                ? `${plural(summary.counts.pending, 'new order')} waiting for a yes, and ${plural(summary.dueToday, 'order')} due today.`
                : summary.dueToday > 0
                  ? `No new orders to confirm. ${plural(summary.dueToday, 'order')} due today.`
                  : 'All caught up. A calm day in the kitchen so far.'
              : 'Fetching today’s orders…'}
          </p>
        </div>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi to="/orders" icon={<BellRing />} label="New orders" value={summary ? String(summary.counts.pending) : null} accent={summary && summary.counts.pending > 0 ? 'cherry' : undefined} />
        <Kpi to="/orders" icon={<CalendarClock />} label="Due today" value={summary ? String(summary.dueToday) : null} />
        <Kpi
          to="/sales"
          icon={<Wallet />}
          label="Today’s takings (paid)"
          value={summary ? formatMoney(takings) : null}
          note={unpaid > 0 ? `${formatMoney(unpaid)} still unpaid` : summary ? `${plural(summary.today.orders, 'order')} today` : undefined}
        />
        <Kpi to="/inventory" icon={<Warehouse />} label="Low stock" value={String(lowStock)} accent={lowStock > 0 ? 'honey' : undefined} note={lowStock > 0 ? 'Items to restock' : 'Shelves look good'} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="p-4 sm:p-5">
          <CardTitle icon={<CalendarClock />} aside={<Link to="/orders" className="sc-link inline-flex min-h-11 items-center text-sm">All orders</Link>}>
            Today’s schedule
          </CardTitle>
          {!board ? (
            boardError ? (
              <p className="py-6 text-center text-cocoa-soft">Couldn’t load today’s orders. <button type="button" className="sc-link" onClick={() => void load(true)}>Try again</button></p>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            )
          ) : schedule.length === 0 ? (
            <Empty icon={<CakeSlice />} title="Nothing due today" body="Orders due today will line up here by time." className="py-8" />
          ) : (
            <ol className="relative ml-2 border-l-2 border-dashed border-plum-100 pl-5">
              {schedule.map(([slot, orders]) => (
                <li key={slot} className="relative pb-5 last:pb-0">
                  <span aria-hidden className="absolute -left-[29px] top-1 size-4 rounded-full border-4 border-cream bg-plum" />
                  <p className="text-sm font-bold tabular text-plum">{slot}</p>
                  <ul className="mt-2 space-y-2">
                    {orders.map((o) => (
                      <li key={o._id}>
                        <Link
                          to={`/orders/${o._id}`}
                          className="flex min-h-14 items-center gap-3 rounded-lg border border-crumb bg-cream/60 px-3 py-2 transition-colors hover:border-plum-200 hover:bg-plum-50"
                        >
                          <TypeIcon order={o} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-cocoa">{customerName(o)}</p>
                            <p className="text-xs tabular text-cocoa-faint">
                              {o.orderNumber} · {plural(itemCount(o), 'item')}
                            </p>
                          </div>
                          <StatusPill status={o.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <CardTitle icon={<BellRing />} aside={board && board.pending.length > waiting.length ? <Link to="/orders" className="sc-link inline-flex min-h-11 items-center text-sm">See all {board.pending.length}</Link> : undefined}>
            Waiting for you
          </CardTitle>
          {!board ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : waiting.length === 0 ? (
            <Empty icon={<Check />} title="No new orders" body="New website orders show up here for a quick yes." className="py-8" />
          ) : (
            <ul className="divide-y divide-crumb">
              {waiting.map((o) => (
                <li key={o._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Link to={`/orders/${o._id}`} className="min-w-0 flex-1 rounded-md hover:text-plum">
                    <p className="truncate font-semibold text-cocoa">{customerName(o)}</p>
                    <p className="truncate text-sm tabular text-cocoa-soft">
                      {o.orderNumber} · {formatMoney(o.totalAmount)} · {timeAgo(o.createdAt)}
                    </p>
                  </Link>
                  <Button size="sm" variant="soft" loading={confirming === o._id} onClick={() => void confirm(o)}>
                    <Check /> Confirm
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">
        <QuickAction to="/pos" icon={<ShoppingBasket />} title="New sale" body="Ring up a counter or phone order" tone="cherry" />
        <QuickAction to="/inventory?session=receive" icon={<PackagePlus />} title="Receive stock" body="Scan a delivery into the store" tone="peach" />
        <QuickAction to="/menu/new" icon={<CakeSlice />} title="Add a menu item" body="Put something new on the site" tone="plum" />
      </section>
    </div>
  );
}

function Kpi({ to, icon, label, value, note, accent }: { to: string; icon: ReactNode; label: string; value: string | null; note?: string; accent?: 'cherry' | 'honey' }) {
  return (
    <Link to={to} className="sc-card group flex flex-col gap-2 p-4 transition-shadow hover:shadow-lift sm:p-5">
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full [&_svg]:size-5',
          accent === 'cherry' ? 'bg-cherry text-white' : accent === 'honey' ? 'bg-honey-200 text-honey-700' : 'bg-plum-50 text-plum'
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-cocoa-soft">{label}</span>
      {value === null ? <Skeleton className="h-8 w-20" /> : <span className="font-display text-2xl font-semibold tabular text-cocoa sm:text-3xl">{value}</span>}
      {note && <span className="text-xs text-cocoa-faint">{note}</span>}
    </Link>
  );
}

function QuickAction({ to, icon, title, body, tone }: { to: string; icon: ReactNode; title: string; body: string; tone: 'cherry' | 'peach' | 'plum' }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-4 rounded-xl p-4 shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lift',
        tone === 'cherry' && 'bg-cherry text-white',
        tone === 'peach' && 'bg-peach text-plum-900',
        tone === 'plum' && 'bg-plum-900 text-cream'
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 [&_svg]:size-6">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="block text-sm opacity-80">{body}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}
