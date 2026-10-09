import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Ban, Bike, CalendarDays, Check, ChefHat, ChevronRight, ClipboardCheck, PackageCheck, PartyPopper, RefreshCw, Search, Store } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { savedCustomer, validPhone } from '../lib/customer';
import {
  findSavedOrder,
  normaliseOrderNumber,
  savedOrders,
  statusHeadline,
  stepCopy,
  TRACK_STEPS,
  type TrackedOrder,
  type TrackStatus,
} from '../lib/tracking';
import { whatsappLink } from '../lib/whatsapp';
import { useSettings } from '../stores/menuStore';
import { cn, formatDateLong, formatMoney, formatStamp, friendlyDay } from '../lib/utils';
import { Button } from '../components/ui/button';
import { buttonStyles } from '../components/ui/button-styles';
import { Field, Input } from '../components/ui/field';
import { describe } from '../lib/aria';
import { Pill, Skeleton, WhatsAppIcon } from '../components/ui/bits';

const dayKey = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value);

function HeroIcon({ status, pickup }: { status: TrackStatus; pickup: boolean }) {
  const cls = 'size-9';
  switch (status) {
    case 'pending':
      return <ClipboardCheck className={cls} aria-hidden />;
    case 'confirmed':
      return <ChefHat className={cls} aria-hidden />;
    case 'ready':
      return pickup ? <PackageCheck className={cls} aria-hidden /> : <Bike className={cls} aria-hidden />;
    case 'delivered':
      return <PartyPopper className={cls} aria-hidden />;
    case 'cancelled':
      return <Ban className={cls} aria-hidden />;
  }
}

function ProgressTrack({ order }: { order: TrackedOrder }) {
  const pickup = order.orderType === 'pickup';
  const reached = TRACK_STEPS.indexOf(order.status as (typeof TRACK_STEPS)[number]);
  const timeOf = (s: TrackStatus) => {
    const hits = order.history.filter((h) => h.status === s);
    const at = hits.length ? hits[hits.length - 1].at : s === 'pending' ? order.placedAt : '';
    return at ? formatStamp(at) : '';
  };

  return (
    <ol className="relative flex flex-col gap-0 md:flex-row" aria-label="Order progress">
      {TRACK_STEPS.map((s, i) => {
        const done = i <= reached;
        const current = i === reached;
        const copy = stepCopy(s, pickup);
        return (
          <li key={s} className="relative flex gap-4 pb-7 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-3 md:pb-0 md:text-center">
            {i < TRACK_STEPS.length - 1 && (
              <span
                className={cn(
                  'absolute left-5 top-10 h-[calc(100%-2.5rem)] w-1 -translate-x-1/2 rounded-full md:left-[calc(50%+1.25rem)] md:top-5 md:h-1 md:w-[calc(100%-2.5rem)] md:translate-x-0 md:-translate-y-1/2',
                  i < reached ? 'bg-plum' : 'bg-crumb'
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-plum bg-plum text-cream' : 'border-crumb-strong bg-card text-cocoa-faint',
                current && 'shadow-ring'
              )}
            >
              {done ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <span className="tabular text-sm font-semibold">{i + 1}</span>}
            </span>
            <div className="pt-1.5 md:pt-0">
              <p className={cn('font-semibold', done ? 'text-cocoa' : 'text-cocoa-faint')}>
                {copy.label}
                <span className="sr-only">{done ? ' (done)' : ' (not yet)'}</span>
              </p>
              <p className={cn('text-sm', done ? 'text-cocoa-soft' : 'text-cocoa-faint')}>{copy.detail}</p>
              {done && timeOf(s) && <p className="tabular mt-0.5 text-xs font-medium text-cherry">{timeOf(s)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Result({ order, refreshing, onRefresh }: { order: TrackedOrder; refreshing: boolean; onRefresh: () => void }) {
  const settings = useSettings();
  const pickup = order.orderType === 'pickup';
  const head = statusHeadline(order.status, pickup);
  const cancelled = order.status === 'cancelled';

  return (
    <div className="space-y-5 animate-rise" aria-live="polite">
      <section
        className={cn(
          'relative overflow-hidden rounded-xl p-6 text-center sm:p-8',
          cancelled ? 'bg-berry-50 ring-1 ring-berry/20' : 'bg-plum text-cream shadow-lift'
        )}
      >
        {!cancelled && <div className="bg-sprinkles absolute inset-0 opacity-25" aria-hidden />}
        <div className="relative">
          <span className={cn('mx-auto flex size-20 items-center justify-center rounded-full', cancelled ? 'bg-card text-berry' : 'bg-peach text-plum-900')}>
            <HeroIcon status={order.status} pickup={pickup} />
          </span>
          <p className={cn('mt-4 text-xs font-semibold uppercase tracking-[0.2em]', cancelled ? 'text-berry-700' : 'text-peach')}>
            {order.orderNumber}
            {order.firstName && ` · for ${order.firstName}`}
          </p>
          <h2 className={cn('mt-1 font-display text-3xl font-semibold sm:text-4xl', cancelled && 'text-berry-700')}>{head.title}</h2>
          <p className={cn('mt-1', cancelled ? 'text-cocoa-soft' : 'text-cream/80')}>{head.sub}</p>
          {cancelled && (
            <a href={whatsappLink(settings.whatsappNumber, `Hi Sugar City, about order ${order.orderNumber}…`)} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'whatsapp', className: 'mt-5' })}>
              <WhatsAppIcon className="size-5" /> Message us
            </a>
          )}
        </div>
      </section>

      {!cancelled && (
        <section className="rounded-xl bg-card p-6 shadow-soft ring-1 ring-crumb/60">
          <ProgressTrack order={order} />
        </section>
      )}

      <section className="rounded-xl bg-card p-6 shadow-soft ring-1 ring-crumb/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach-50 text-plum">
              {pickup ? <Store className="size-5" aria-hidden /> : <Bike className="size-5" aria-hidden />}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">{pickup ? 'Pickup' : 'Delivery'}</p>
              <p className="font-semibold">
                {order.date ? formatDateLong(dayKey(order.date)) : 'Date to be confirmed'}
                {order.time && <span className="font-normal text-cocoa-soft"> · {order.time}</span>}
              </p>
            </div>
          </div>
          {order.paid ? <Pill tone="mint">Paid</Pill> : <Pill tone="honey">Awaiting payment</Pill>}
        </div>

        <ul className="mt-5 divide-y divide-crumb border-y border-crumb">
          {order.items.map((it, i) => (
            <li key={i} className="py-3">
              <p className="font-semibold">
                <span className="tabular text-cocoa-faint">{it.quantity}×</span> {it.name}
              </p>
              {it.options.length > 0 && <p className="text-sm text-cocoa-soft">{it.options.join(' · ')}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="tabular font-display text-2xl font-semibold text-plum">{formatMoney(order.totalAmount)}</span>
        </div>

        <Button variant="soft" block className="mt-5" onClick={onRefresh} loading={refreshing}>
          {!refreshing && <RefreshCw className="size-4" aria-hidden />}
          Refresh status
        </Button>
      </section>
    </div>
  );
}

interface Query {
  number: string;
  phone: string;
  nonce: number;
}
type Response = { key: string; data?: TrackedOrder; error?: string };
const keyOf = (q: Query) => `${q.number}|${q.phone}|${q.nonce}`;

function TrackView({ number }: { number: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const recent = useMemo(() => savedOrders(), []);

  const knownPhone =
    (location.state as { phone?: string } | null)?.phone ?? (number ? findSavedOrder(number)?.phone : undefined) ?? savedCustomer().phone ?? '';

  const [numberInput, setNumberInput] = useState(number);
  const [phoneInput, setPhoneInput] = useState(knownPhone);
  const [formError, setFormError] = useState<{ field: 'number' | 'phone'; message: string } | null>(null);
  const [query, setQuery] = useState<Query | null>(number && validPhone(knownPhone) ? { number, phone: knownPhone, nonce: 0 } : null);
  const [response, setResponse] = useState<Response | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const key = keyOf(query);
    api
      .get<TrackedOrder>('/orders/track', { params: { number: query.number, phone: query.phone } })
      .then(({ data }) => !cancelled && setResponse({ key, data }))
      .catch((err) => !cancelled && setResponse({ key, error: errorMessage(err, 'We couldn’t find that order. Check the number and phone.') }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = !!query && response?.key !== keyOf(query);
  const result = response?.data;

  const lookup = (rawNumber: string, phone: string) => {
    const n = normaliseOrderNumber(rawNumber);
    if (!/^SC-\d+$/.test(n)) {
      setFormError({ field: 'number', message: 'Order numbers look like SC-1042.' });
      document.getElementById('tr-number')?.focus();
      return;
    }
    if (!validPhone(phone)) {
      setFormError({ field: 'phone', message: 'Enter the phone number used for the order.' });
      document.getElementById('tr-phone')?.focus();
      return;
    }
    setFormError(null);
    if (n !== number) navigate(`/track/${encodeURIComponent(n)}`, { state: { phone } });
    else setQuery((q) => ({ number: n, phone, nonce: (q?.nonce ?? 0) + 1 }));
  };

  const others = recent.filter((r) => r.orderNumber !== number);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <header className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-peach-50 text-plum">
          <Search className="size-6" aria-hidden />
        </span>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-plum sm:text-5xl">Track your order</h1>
        <p className="mt-2 text-cocoa-soft">See where your treats are, from the oven to your hands.</p>
      </header>

      <div className="mt-8 space-y-6">
        {loading && !result && (
          <div className="space-y-4" aria-label="Looking up your order">
            <Skeleton className="h-60 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        )}
        {result && <Result order={result} refreshing={loading} onRefresh={() => setQuery((q) => (q ? { ...q, nonce: q.nonce + 1 } : q))} />}
        {!loading && response?.error && (
          <div role="alert" className="rounded-xl bg-berry-50 p-5 text-center ring-1 ring-berry/20">
            <p className="font-semibold text-berry-700">{response.error}</p>
          </div>
        )}

        {others.length > 0 && (
          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cocoa-faint">
              Ordered on this device
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((o) => (
                <li key={o.orderNumber}>
                  <button
                    type="button"
                    onClick={() => lookup(o.orderNumber, o.phone)}
                    className="group flex w-full items-center gap-3 rounded-lg bg-card p-4 text-left shadow-soft ring-1 ring-crumb/60 transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-plum-50 text-plum">
                      {o.orderType === 'pickup' ? <Store className="size-5" aria-hidden /> : <Bike className="size-5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="tabular block font-display text-lg font-semibold text-plum">{o.orderNumber}</span>
                      <span className="flex items-center gap-1.5 text-sm text-cocoa-soft">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {friendlyDay(o.date)} · {o.time}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-cocoa-faint transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            lookup(numberInput, phoneInput);
          }}
          className="rounded-xl bg-card p-6 shadow-soft ring-1 ring-crumb/60"
        >
          <h2 className="font-display text-2xl font-semibold text-plum">{result ? 'Look up another order' : 'Find an order'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
            <Field id="tr-number" label="Order number" hint="Starts with SC" error={formError?.field === 'number' ? formError.message : undefined}>
              <Input
                {...describe('tr-number', formError?.field === 'number' ? formError.message : undefined, true)}
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                placeholder="SC-1042"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </Field>
            <Field id="tr-phone" label="Phone number" error={formError?.field === 'phone' ? formError.message : undefined}>
              <Input
                {...describe('tr-phone', formError?.field === 'phone' ? formError.message : undefined)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
            </Field>
            <Button type="submit" className="sm:mt-[26px]" loading={loading && !result}>
              Track
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrackPage() {
  const { number } = useParams();
  const n = number ? normaliseOrderNumber(number) : '';
  return <TrackView key={n} number={n} />;
}
