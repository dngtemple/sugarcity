import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GripVertical, Inbox } from 'lucide-react';
import { onOrdersChanged } from '../../lib/events';
import { useVisiblePoll } from '../../lib/hooks';
import { customerName, dueOf, fetchBoard, itemCount, nextStep, type Board, type Order, type OrderStatus } from '../../lib/orders';
import { cn, formatMoney, orderDateKey, plural, slotMinutes } from '../../lib/utils';
import { Button } from '../ui/Button';
import { LoadError, Skeleton } from '../ui/Bits';
import { DueTag, PaymentPill, TypeIcon } from './OrderBits';
import { changeStatus } from './statusChange';

type Column = keyof Board;

const COLUMNS: { key: Column; title: string; hint: string; dot: string }[] = [
  { key: 'pending', title: 'New', hint: 'Waiting for a yes', dot: 'bg-cherry' },
  { key: 'confirmed', title: 'Confirmed', hint: 'In the oven, or soon', dot: 'bg-sky-700' },
  { key: 'ready', title: 'Ready', hint: 'Boxed and waiting', dot: 'bg-honey-700' },
];

const byDue = (a: Order, b: Order) =>
  (orderDateKey(a.deliveryDate) || '9999').localeCompare(orderDateKey(b.deliveryDate) || '9999') ||
  (slotMinutes(a.deliveryTime) ?? 9999) - (slotMinutes(b.deliveryTime) ?? 9999);

/** Moves an order between columns locally (or off the board when completed/cancelled). */
function moveLocal(board: Board, order: Order, to: OrderStatus): Board {
  const without = {
    pending: board.pending.filter((o) => o._id !== order._id),
    confirmed: board.confirmed.filter((o) => o._id !== order._id),
    ready: board.ready.filter((o) => o._id !== order._id),
  };
  if (to !== 'pending' && to !== 'confirmed' && to !== 'ready') return without;
  const moved = { ...order, status: to };
  if (to === 'pending') return { ...without, pending: [moved, ...without.pending] };
  return { ...without, [to]: [...without[to], moved].sort(byDue) };
}

export function OrderBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [dropTarget, setDropTarget] = useState<Column | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dragged = useRef<Order | null>(null);

  const load = useCallback(
    (force = true) =>
      fetchBoard(force)
        .then((b) => {
          setBoard(b);
          setError(false);
        })
        .catch(() => setError(true)),
    []
  );

  useEffect(() => {
    void load(false);
    return onOrdersChanged(() => void load());
  }, [load]);
  useVisiblePoll(() => void load(), 60_000);

  const move = async (order: Order, to: OrderStatus, done?: string) => {
    if (order.status === to || !board) return;
    setBoard((b) => (b ? moveLocal(b, order, to) : b));
    setBusy(order._id);
    try {
      await changeStatus(order, to, { done });
    } catch {
      void load();
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (e: DragEvent, column: Column) => {
    e.preventDefault();
    setDropTarget(null);
    const order = dragged.current;
    dragged.current = null;
    if (order && order.status !== column) void move(order, column);
  };

  if (error && !board) return <LoadError message="We couldn’t load the board." onRetry={() => void load()} />;

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
      {COLUMNS.map((col) => {
        const orders = board?.[col.key] ?? [];
        return (
          <section
            key={col.key}
            aria-label={`${col.title} orders`}
            onDragOver={(e) => {
              if (!dragged.current) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dropTarget !== col.key) setDropTarget(col.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget((t) => (t === col.key ? null : t));
            }}
            onDrop={(e) => onDrop(e, col.key)}
            className={cn(
              'flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-xl bg-cream-deep/70 p-3 transition-colors sm:w-80 lg:w-auto lg:max-w-none',
              dropTarget === col.key && 'board-drop'
            )}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={cn('size-2.5 rounded-full', col.dot)} aria-hidden />
              <h2 className="font-display text-lg font-semibold text-cocoa">{col.title}</h2>
              <span className="rounded-full bg-card px-2 text-sm font-bold tabular leading-6 text-cocoa-soft">{board ? orders.length : '…'}</span>
              <span className="ml-auto hidden text-xs text-cocoa-faint xl:inline">{col.hint}</span>
            </header>
            <div className="flex min-h-40 flex-1 flex-col gap-2.5">
              {!board ? (
                <>
                  <Skeleton className="h-36 bg-card" />
                  <Skeleton className="h-36 bg-card" />
                </>
              ) : orders.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-crumb-strong px-4 py-8 text-center text-sm text-cocoa-faint">
                  <Inbox className="mb-2 size-6" aria-hidden />
                  Nothing here
                </div>
              ) : (
                orders.map((o) => (
                  <BoardCard
                    key={o._id}
                    order={o}
                    busy={busy === o._id}
                    onDragStart={() => {
                      dragged.current = o;
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                      setDropTarget(null);
                    }}
                    onAdvance={() => {
                      const step = nextStep(o);
                      if (step) void move(o, step.status, step.done);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({
  order,
  busy,
  onDragStart,
  onDragEnd,
  onAdvance,
}: {
  order: Order;
  busy: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAdvance: () => void;
}) {
  const step = nextStep(order);
  const overdue = dueOf(order).tone === 'overdue';
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', order._id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative rounded-lg border bg-card p-3.5 shadow-soft transition-shadow hover:shadow-lift',
        overdue ? 'border-berry/40' : 'border-crumb',
        busy && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 hidden size-4 shrink-0 cursor-grab text-cocoa-faint lg:block" aria-hidden />
        <Link to={`/orders/${order._id}`} draggable={false} className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-lg">
          <p className="text-xs font-bold tabular text-plum">{order.orderNumber}</p>
          <p className="truncate font-semibold text-cocoa">{customerName(order)}</p>
        </Link>
        <p className="font-semibold tabular text-cocoa">{formatMoney(order.totalAmount)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DueTag order={order} />
        <span className="inline-flex items-center gap-1 text-sm text-cocoa-soft">
          <TypeIcon order={order} />
          {plural(itemCount(order), 'item')}
        </span>
      </div>
      <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
        <PaymentPill order={order} />
        {step && (
          <Button size="sm" variant={order.status === 'pending' ? 'primary' : 'soft'} loading={busy} onClick={onAdvance}>
            {step.short} <ArrowRight />
          </Button>
        )}
      </div>
    </article>
  );
}
