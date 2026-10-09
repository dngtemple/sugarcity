import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Bike, CalendarDays, Gift, PackageSearch, PartyPopper, Store, Wallet } from 'lucide-react';
import { useSettings } from '../stores/menuStore';
import { findSavedOrder, type SavedOrder } from '../lib/tracking';
import { buildOrderMessage, whatsappLink } from '../lib/whatsapp';
import { firstName, formatDateLong, formatMoney } from '../lib/utils';
import { buttonStyles } from '../components/ui/button-styles';
import { WhatsAppIcon } from '../components/ui/bits';

export default function OrderPage() {
  const { number = '' } = useParams();
  const location = useLocation();
  const settings = useSettings();
  const fromState = (location.state as { order?: SavedOrder } | null)?.order;
  const order = fromState?.orderNumber === number ? fromState : findSavedOrder(number);

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 pt-16 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-peach-50 text-plum">
          <PackageSearch className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold text-plum">We can’t find that receipt here</h1>
        <p className="mt-2 text-cocoa-soft">It may have been placed on another phone. You can still look it up with your phone number.</p>
        <Link to={`/track/${encodeURIComponent(number)}`} className={buttonStyles({ className: 'mt-6' })}>
          Track {number || 'an order'}
        </Link>
      </div>
    );
  }

  const pickup = order.orderType === 'pickup';
  const message = buildOrderMessage({
    orderNumber: order.orderNumber,
    lines: order.lines,
    total: order.total,
    customerName: order.customerName,
    customerPhone: order.phone,
    orderType: order.orderType,
    date: order.date,
    time: order.time,
    address: order.address,
    landmark: order.landmark,
    pickupAddress: settings.pickupAddress,
    notes: order.notes,
    gift: order.gift,
  });

  return (
    <div className="relative mx-auto max-w-xl px-4 pt-8 sm:pt-12">
      <div className="bg-sprinkles pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60" aria-hidden />

      <div className="relative [filter:drop-shadow(0_18px_30px_rgb(94_14_78/0.14))_drop-shadow(0_2px_4px_rgb(94_14_78/0.06))] animate-rise">
        <article className="edge-scallop bg-card px-6 pb-12 pt-12 sm:px-10" aria-labelledby="thanks">
          <div className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-peach text-plum">
              <PartyPopper className="size-6" aria-hidden />
            </span>
            <h1 id="thanks" className="mt-4 font-display text-4xl font-semibold tracking-tight text-plum">
              Thank you, {firstName(order.customerName) || 'friend'}!
            </h1>
            <p className="mt-1 text-cocoa-soft">Your order is saved. One more step and we’re baking.</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-cocoa-faint">Order number</p>
            <p className="tabular font-display text-5xl font-bold tracking-tight text-cocoa sm:text-6xl">{order.orderNumber}</p>
          </div>

          <div className="my-7 border-t-2 border-dashed border-crumb" />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-cherry" aria-hidden />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">When</dt>
                <dd className="font-semibold">{formatDateLong(order.date)}</dd>
                <dd className="text-cocoa-soft">{order.time}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              {pickup ? <Store className="mt-0.5 size-5 shrink-0 text-cherry" aria-hidden /> : <Bike className="mt-0.5 size-5 shrink-0 text-cherry" aria-hidden />}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">{pickup ? 'Pickup from' : 'Delivering to'}</dt>
                <dd className="font-semibold">{pickup ? settings.pickupAddress || 'Our shop' : order.address}</dd>
                {!pickup && order.landmark && <dd className="text-cocoa-soft">Near {order.landmark}</dd>}
              </div>
            </div>
            {order.gift && (
              <div className="flex gap-3 sm:col-span-2">
                <Gift className="mt-0.5 size-5 shrink-0 text-cherry" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">A gift for</dt>
                  <dd className="font-semibold">
                    {order.gift.recipientName} <span className="font-normal text-cocoa-soft">{order.gift.recipientPhone}</span>
                  </dd>
                  {order.gift.message && <dd className="italic text-cocoa-soft">“{order.gift.message}”</dd>}
                </div>
              </div>
            )}
          </dl>

          <div className="my-7 border-t-2 border-dashed border-crumb" />

          <ul className="space-y-3">
            {order.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    <span className="tabular text-cocoa-faint">{l.quantity}×</span> {l.name}
                  </p>
                  {l.options.length > 0 && <p className="text-sm text-cocoa-soft">{l.options.map((o) => o.name).join(' · ')}</p>}
                  {l.message && <p className="text-sm italic text-cocoa-soft">“{l.message}”</p>}
                </div>
                <p className="tabular shrink-0">{formatMoney(l.unitPrice * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t-2 border-cocoa pt-4">
            <span className="font-semibold uppercase tracking-wider">Total</span>
            <span className="tabular font-display text-3xl font-bold text-plum">{formatMoney(order.total)}</span>
          </div>
          {!pickup && <p className="mt-1 text-right text-xs text-cocoa-faint">Plus delivery, agreed on WhatsApp.</p>}

          <div className="mt-7 rounded-lg bg-peach-50 p-5 ring-1 ring-peach">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-plum">
              <Wallet className="size-5" aria-hidden /> How to pay
            </h2>
            <p className="mt-2 whitespace-pre-line text-[15px] text-cocoa">
              {settings.paymentInstructions || 'We’ll share payment details when we confirm your order on WhatsApp.'}
            </p>
            <p className="mt-3 text-sm font-semibold text-cocoa">
              Use <span className="tabular rounded bg-card px-1.5 py-0.5 text-plum">{order.orderNumber}</span> as your reference.
            </p>
          </div>
        </article>
      </div>

      <div className="relative mt-8 space-y-3">
        <p className="text-center text-sm font-medium text-cocoa-soft">Last step: send it to us so we can confirm.</p>
        <a href={whatsappLink(settings.whatsappNumber, message)} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'whatsapp', size: 'lg', block: true, className: 'text-[17px]' })}>
          <WhatsAppIcon className="size-6" />
          Send order on WhatsApp
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to={`/track/${encodeURIComponent(order.orderNumber)}`} className={buttonStyles({ variant: 'outline' })}>
            <PackageSearch className="size-4" aria-hidden />
            Track this order
          </Link>
          <Link to="/menu" className={buttonStyles({ variant: 'ghost' })}>
            Back to the menu
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
