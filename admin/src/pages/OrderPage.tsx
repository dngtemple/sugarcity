import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CreditCard,
  Gift,
  History,
  MapPin,
  MessageCircle,
  NotebookPen,
  Phone,
  RotateCcw,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';
import api, { errorMessage, statusOf } from '../lib/api';
import { notifyOrdersChanged, onOrdersChanged } from '../lib/events';
import {
  STATUS_LABEL,
  customerName,
  linesByCollection,
  nextStep,
  optionsByGroup,
  orderType,
  setPayment,
  type Order,
  type OrderStatus,
} from '../lib/orders';
import { cn, firstName, formatDateTime, formatDay, formatMoney, localNumber, orderDateKey, whatsappLink } from '../lib/utils';
import { Card, CardTitle, Empty, Skeleton } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { buttonClass } from '../components/ui/buttonStyles';
import { Confirm } from '../components/ui/Confirm';
import { DueTag, PaymentPill, StatusPill } from '../components/orders/OrderBits';
import { changeStatus } from '../components/orders/statusChange';

export function OrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'status' | 'payment' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<Order>(`/orders/${id}`)
        .then(({ data }) => {
          setOrder(data);
          setError(null);
        })
        .catch((err) => {
          if (statusOf(err) === 404 || statusOf(err) === 400) setMissing(true);
          else setError(errorMessage(err, 'We couldn’t load this order.'));
        }),
    [id]
  );

  useEffect(() => {
    void load();
    return onOrdersChanged(() => void load());
  }, [load]);

  const move = async (status: OrderStatus, done?: string) => {
    if (!order) return;
    setBusy('status');
    try {
      const saved = await changeStatus(order, status, { done, onUndone: setOrder });
      setOrder(saved);
    } catch {
      // toast shown
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const togglePaid = async () => {
    if (!order) return;
    const next = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    setBusy('payment');
    try {
      const saved = await setPayment(order._id, next);
      setOrder(saved);
      notifyOrdersChanged();
      toast.success(next === 'paid' ? `${order.orderNumber} marked paid` : `${order.orderNumber} marked unpaid`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t update the payment.'));
    } finally {
      setBusy(null);
    }
  };

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/orders'));

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <Empty
            icon={<ShoppingBag />}
            title="Order not found"
            body="It may have been removed, or the link is wrong."
            action={
              <Link to="/orders" className={buttonClass('primary')}>
                Back to orders
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {error ? (
          <Card className="p-8 text-center">
            <p className="font-semibold text-cocoa">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => void load()}>
              Try again
            </Button>
          </Card>
        ) : (
          <>
            <Skeleton className="h-16 w-72" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </>
        )}
      </div>
    );
  }

  const step = nextStep(order);
  const delivery = orderType(order) === 'delivery';
  const name = customerName(order);
  const phone = order.customerPhone?.trim() ?? '';
  const greeting = `Hi ${firstName(name) || 'there'}, it’s Sugar City here about your order ${order.orderNumber}. `;
  const groups = linesByCollection(order.items);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 lg:pt-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={back} className="inline-flex size-11 items-center justify-center rounded-full bg-card text-plum shadow-soft hover:bg-plum-50" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tabular text-plum">{order.orderNumber}</h1>
            <StatusPill status={order.status} />
            <PaymentPill order={order} />
          </div>
          <p className="text-sm text-cocoa-soft">
            Placed {formatDateTime(order.createdAt)} · {order.isWalkIn ? 'at the counter' : 'on the website'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 pb-32 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Left: what they ordered */}
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <CardTitle icon={<ShoppingBag />}>What’s in the order</CardTitle>
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.collection}>
                  {groups.length > 1 && <p className="sc-eyebrow mb-2">{g.label}</p>}
                  <ul className="divide-y divide-dashed divide-crumb">
                    {g.items.map((line, i) => (
                      <li key={i} className="flex gap-3 py-3 first:pt-0">
                        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-plum-50 px-2 text-sm font-bold tabular text-plum">{line.quantity}×</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-cocoa">{line.name}</p>
                          {optionsByGroup(line.options).map(([group, names]) => (
                            <p key={group} className="text-sm text-cocoa-soft">
                              <span className="text-cocoa-faint">{group}:</span> {names.join(', ')}
                            </p>
                          ))}
                          {line.message && (
                            <p className="mt-1.5 inline-block rounded-md bg-peach-50 px-2.5 py-1 text-sm text-peach-700">
                              Message: “{line.message}”
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular text-cocoa">{formatMoney(line.price * line.quantity)}</p>
                          {line.quantity > 1 && <p className="text-xs tabular text-cocoa-faint">{formatMoney(line.price)} each</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t-2 border-plum-100 pt-4">
              <span className="font-display text-lg font-semibold text-cocoa">Total</span>
              <span className="font-display text-2xl font-semibold tabular text-plum">{formatMoney(order.totalAmount)}</span>
            </div>
          </Card>

          {order.notes?.trim() && (
            <div className="rounded-xl border border-honey-200 bg-honey-50 p-4 sm:p-5">
              <p className="mb-1 flex items-center gap-2 text-sm font-bold text-honey-700">
                <NotebookPen className="size-4" aria-hidden /> Notes from the customer
              </p>
              <p className="whitespace-pre-line text-[15px] text-cocoa">{order.notes}</p>
            </div>
          )}

          {order.gift && (
            <div className="rounded-xl border border-cherry/20 bg-cherry-50 p-4 sm:p-5">
              <p className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-cherry-700">
                <Gift className="size-5" aria-hidden /> It’s a gift
              </p>
              <dl className="space-y-1.5 text-[15px]">
                <Row label="For">{order.gift.recipientName}</Row>
                {order.gift.recipientPhone && (
                  <Row label="Their phone">
                    <a href={`tel:${order.gift.recipientPhone}`} className="sc-link tabular">
                      {order.gift.recipientPhone}
                    </a>
                  </Row>
                )}
                {order.gift.message && <Row label="Card says">“{order.gift.message}”</Row>}
              </dl>
            </div>
          )}
        </div>

        {/* Right: who, when, money, history */}
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <CardTitle icon={<UserRound />}>Customer</CardTitle>
            <p className="text-lg font-semibold text-cocoa">{name}</p>
            {phone ? (
              <>
                <p className="tabular text-cocoa-soft">{localNumber(phone)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={whatsappLink(phone, greeting)} target="_blank" rel="noreferrer" className={buttonClass('soft', 'md', 'bg-mint-50 text-mint-700 hover:bg-mint-50/70')}>
                    <MessageCircle /> WhatsApp
                  </a>
                  <a href={`tel:${phone}`} className={buttonClass('outline', 'md')}>
                    <Phone /> Call
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-cocoa-faint">No phone number given.</p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <CardTitle icon={delivery ? <Truck /> : <Store />}>{delivery ? 'Delivery' : 'Pickup'}</CardTitle>
            <dl className="space-y-2 text-[15px]">
              <Row label="When">
                {order.deliveryDate ? `${formatDay(orderDateKey(order.deliveryDate))}${order.deliveryTime ? ` · ${order.deliveryTime}` : ''}` : 'Not set'}
              </Row>
              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                <Row label="Due">
                  <DueTag order={order} />
                </Row>
              )}
              {delivery && (
                <Row label="Address">
                  <span className="inline-flex gap-1.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-cherry" aria-hidden />
                    <span>
                      {order.deliveryLocation || '—'}
                      {order.landmark && <span className="block text-sm text-cocoa-soft">Near {order.landmark}</span>}
                    </span>
                  </span>
                </Row>
              )}
            </dl>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardTitle icon={<CreditCard />} aside={<PaymentPill order={order} />}>
              Payment
            </CardTitle>
            <p className="text-[15px] text-cocoa-soft">
              {order.paymentStatus === 'paid'
                ? `Paid${order.paidAt ? ` ${formatDateTime(order.paidAt)}` : ''}. ${formatMoney(order.totalAmount)} received.`
                : `${formatMoney(order.totalAmount)} still to collect.`}
            </p>
            <Button variant={order.paymentStatus === 'paid' ? 'outline' : 'primary'} className="mt-3" block loading={busy === 'payment'} onClick={togglePaid}>
              {order.paymentStatus === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
            </Button>
          </Card>

          <Card className="p-4 sm:p-5">
            <CardTitle icon={<History />}>Timeline</CardTitle>
            <ol className="relative space-y-3 border-l-2 border-plum-100 pl-5">
              <TimelineItem title={order.isWalkIn ? 'Taken at the counter' : 'Placed online'} at={order.createdAt} first />
              {(order.statusHistory ?? [])
                .filter((h, i) => !(i === 0 && h.status === 'pending'))
                .map((h, i) => (
                  <TimelineItem key={i} title={h.status === 'pending' ? 'Moved back to New' : STATUS_LABEL[h.status]} at={h.timestamp} note={h.note} />
                ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Sticky actions */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-crumb bg-cream/95 px-4 pt-3 pb-safe backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {step && (
            <Button size="lg" loading={busy === 'status'} onClick={() => void move(step.status, step.done)} className="flex-1 sm:flex-none">
              {step.label} <ArrowRight />
            </Button>
          )}
          {order.status === 'delivered' && (
            <Button size="lg" variant="outline" loading={busy === 'status'} onClick={() => void move('ready', 'moved back to Ready')} className="flex-1 sm:flex-none">
              <RotateCcw /> Move back to Ready
            </Button>
          )}
          {order.status === 'cancelled' && (
            <Button size="lg" loading={busy === 'status'} onClick={() => void move('pending', 'restored to New')} className="flex-1 sm:flex-none">
              <RotateCcw /> Restore order
            </Button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Button size="lg" variant="ghost" className={cn('text-berry hover:bg-berry-50 hover:text-berry', 'sm:ml-auto')} onClick={() => setConfirmCancel(true)}>
              <Ban /> Cancel order
            </Button>
          )}
        </div>
      </div>

      <Confirm
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel ${order.orderNumber}?`}
        body={
          <>
            The order moves to Cancelled. <strong className="text-cocoa">{firstName(name) || 'The customer'} isn’t told automatically</strong> — send them a WhatsApp message
            if they need to know. You can restore it later.
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        loading={busy === 'status'}
        onConfirm={() => void move('cancelled', 'cancelled')}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
      <dt className="text-cocoa-faint">{label}</dt>
      <dd className="min-w-0 text-cocoa">{children}</dd>
    </div>
  );
}

function TimelineItem({ title, at, note, first }: { title: string; at: string; note?: string; first?: boolean }) {
  return (
    <li className="relative">
      <span aria-hidden className={cn('absolute -left-[27px] top-1.5 size-3 rounded-full ring-4 ring-card', first ? 'bg-peach-700' : 'bg-plum')} />
      <p className="text-[15px] font-semibold text-cocoa">{title}</p>
      <p className="text-sm text-cocoa-faint">
        {formatDateTime(at)}
        {note ? ` · ${note}` : ''}
      </p>
    </li>
  );
}
