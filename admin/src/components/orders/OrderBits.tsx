import { AlertCircle, Clock, Store, Truck } from 'lucide-react';
import { STATUS_LABEL, STATUS_STYLE, dueOf, orderType, type Order, type OrderStatus } from '../../lib/orders';
import { cn } from '../../lib/utils';
import { Pill } from '../ui/Bits';

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset', STATUS_STYLE[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PaymentPill({ order }: { order: Pick<Order, 'paymentStatus'> }) {
  return order.paymentStatus === 'paid' ? <Pill tone="mint">Paid</Pill> : <Pill tone="honey">Unpaid</Pill>;
}

export function TypeIcon({ order, className }: { order: Pick<Order, 'orderType' | 'deliveryLocation'>; className?: string }) {
  const delivery = orderType(order) === 'delivery';
  const Icon = delivery ? Truck : Store;
  return (
    <span className={cn('inline-flex items-center gap-1 text-cocoa-soft', className)} title={delivery ? 'Delivery' : 'Pickup'}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{delivery ? 'Delivery' : 'Pickup'}</span>
    </span>
  );
}

/** When it's due, coloured by urgency: overdue in berry, today in plum. */
export function DueTag({ order, className }: { order: Pick<Order, 'deliveryDate' | 'deliveryTime' | 'status'>; className?: string }) {
  const due = dueOf(order);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-semibold tabular',
        due.tone === 'overdue' ? 'text-berry' : due.tone === 'today' ? 'text-plum' : due.tone === 'tomorrow' ? 'text-peach-700' : 'text-cocoa-soft',
        className
      )}
    >
      {due.tone === 'overdue' ? <AlertCircle className="size-4 shrink-0" aria-hidden /> : <Clock className="size-4 shrink-0" aria-hidden />}
      {due.label}
    </span>
  );
}
