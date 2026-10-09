import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Bike, Check, ChevronDown, Clock, Gift, Pencil, Store } from 'lucide-react';
import api, { errorMessage, warmUpApi } from '../lib/api';
import { bagCount, bagTotal, useBag, type BagLine } from '../stores/bagStore';
import { useSettings } from '../stores/menuStore';
import { noticeDaysFor } from '../lib/menu';
import { savedCustomer, saveCustomer, validPhone } from '../lib/customer';
import { saveOrder, type SavedOrder } from '../lib/tracking';
import { buildOrderMessage, whatsappLink } from '../lib/whatsapp';
import { addDays, availableSlots, cn, dateKey, formatDateLong, formatMoney, friendlyDay, randomId } from '../lib/utils';
import { Button } from '../components/ui/button';
import { buttonStyles } from '../components/ui/button-styles';
import { Field, Input, Textarea } from '../components/ui/field';
import { describe } from '../lib/aria';
import { TreatImage, WhatsAppIcon } from '../components/ui/bits';
import { DatePickerCards } from '../components/DatePickerCards';

type Step = 1 | 2 | 3;
type OrderType = 'pickup' | 'delivery';
type Errors = Partial<Record<string, string>>;

const STEP_NAMES = ['When & how', 'Your details', 'Review'];
const CARD_MAX = 200;
const NOTES_MAX = 500;

function Progress({ step, onJump }: { step: Step; onJump: (s: Step) => void }) {
  return (
    <ol className="flex items-start" aria-label="Checkout progress">
      {STEP_NAMES.map((name, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const current = n === step;
        return (
          <li key={name} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span className={cn('absolute right-1/2 top-5 h-1 w-full -translate-y-1/2 rounded-full', n <= step ? 'bg-plum' : 'bg-crumb')} aria-hidden />
            )}
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(n)}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'relative z-10 flex size-10 items-center justify-center rounded-full border-2 font-semibold transition',
                current && 'border-plum bg-plum text-cream shadow-ring',
                done && 'border-plum bg-plum text-cream hover:bg-plum-700',
                !done && !current && 'border-crumb-strong bg-card text-cocoa-faint'
              )}
            >
              {done ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <span className="tabular">{n}</span>}
              <span className="sr-only">
                {' '}
                {name}
                {done ? ' (done, tap to edit)' : ''}
              </span>
            </button>
            <span className={cn('mt-2 text-center text-xs font-semibold sm:text-sm', current ? 'text-plum' : 'text-cocoa-faint')} aria-hidden>
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceCard({ on, onClick, icon: Icon, title, detail }: { on: boolean; onClick: () => void; icon: typeof Store; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'relative flex min-h-[120px] flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition active:scale-[0.98] sm:p-5',
        on ? 'border-plum bg-plum-50 shadow-ring' : 'border-crumb bg-card hover:border-plum/40'
      )}
    >
      <span className={cn('flex size-11 items-center justify-center rounded-full', on ? 'bg-plum text-cream' : 'bg-peach-50 text-plum')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="font-display text-xl font-semibold text-cocoa">{title}</span>
      <span className="text-sm text-cocoa-soft">{detail}</span>
      <span
        className={cn('absolute right-4 top-4 flex size-6 items-center justify-center rounded-full border-2', on ? 'border-plum bg-plum text-cream' : 'border-crumb-strong')}
        aria-hidden
      >
        {on && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function BagSummary({ lines, total }: { lines: BagLine[]; total: number }) {
  return (
    <div>
      <ul className="divide-y divide-crumb">
        {lines.map((l) => (
          <li key={l.key} className="flex gap-3 py-3">
            <div className="relative shrink-0">
              <TreatImage src={l.image} alt="" section={l.section} className="size-14 rounded-md" />
              <span className="tabular absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-plum px-1 text-xs font-bold text-cream ring-2 ring-card">
                {l.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{l.name}</p>
              {l.options.length > 0 && <p className="text-sm text-cocoa-soft">{l.options.map((o) => o.name).join(' · ')}</p>}
              {l.message && <p className="text-sm italic text-cocoa-soft">“{l.message}”</p>}
            </div>
            <p className="tabular shrink-0 font-semibold">{formatMoney(l.unitPrice * l.quantity)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-crumb pt-4">
        <span className="font-semibold">Total</span>
        <span className="tabular font-display text-2xl font-semibold text-plum">{formatMoney(total)}</span>
      </div>
      <p className="mt-1 text-xs text-cocoa-faint">Any delivery fee is agreed on WhatsApp.</p>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-cream p-4 ring-1 ring-crumb">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">{title}</h3>
        <button type="button" onClick={onEdit} className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-plum hover:bg-plum-50">
          <Pencil className="size-3.5" aria-hidden /> Edit
        </button>
      </div>
      <div className="space-y-0.5 text-[15px]">{children}</div>
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const lines = useBag((s) => s.lines);
  const clear = useBag((s) => s.clear);
  const total = bagTotal(lines);
  const anyGift = lines.some((l) => l.isGift);

  const saved = useMemo(() => savedCustomer(), []);
  const [step, setStep] = useState<Step>(1);
  const [orderType, setOrderType] = useState<OrderType>(saved.orderType ?? (anyGift ? 'delivery' : 'pickup'));
  const [pickedDate, setDate] = useState('');
  const [pickedTime, setTime] = useState('');
  const [name, setName] = useState(saved.name ?? '');
  const [phone, setPhone] = useState(saved.phone ?? '');
  const [address, setAddress] = useState(saved.address ?? '');
  const [landmark, setLandmark] = useState(saved.landmark ?? '');
  const [isGift, setIsGift] = useState(anyGift);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const [placing, setPlacing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const clientRef = useRef(randomId());
  const [placed, setPlaced] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => warmUpApi(), []);

  const notice = noticeDaysFor(settings, new Set(lines.map((l) => l.section)));
  const minDate = addDays(dateKey(), notice);
  // Settings can arrive (or the clock move on) after a choice was made, so a
  // picked day/time only counts while it is still bookable.
  const date = pickedDate && pickedDate >= minDate ? pickedDate : '';
  const slots = date ? availableSlots(date, settings.openHour, settings.closeHour) : [];
  const time = pickedTime && slots.some((s) => s.label === pickedTime) ? pickedTime : '';

  if (lines.length === 0 && !placed) return <Navigate to="/menu" replace />;

  const gift = isGift ? { recipientName: recipientName.trim(), recipientPhone: recipientPhone.trim(), message: cardMessage.trim() } : undefined;

  const validate = (s: Step): Errors => {
    const e: Errors = {};
    if (s === 1) {
      if (!date) e.date = 'Pick a day for your order.';
      if (!time) e.time = date && slots.length === 0 ? 'No times left on this day. Try another.' : 'Pick a time.';
    }
    if (s === 2) {
      if (name.trim().length < 2) e.name = 'Tell us your name.';
      if (!validPhone(phone)) e.phone = 'Enter a phone number we can reach you on.';
      if (orderType === 'delivery' && address.trim().length < 3) e.address = isGift ? 'Where should the gift go?' : 'Where should we deliver?';
      if (landmark.length > 120) e.landmark = 'Keep it under 120 characters.';
      if (isGift) {
        if (recipientName.trim().length < 2) e.recipientName = 'Who is the gift for?';
        if (!validPhone(recipientPhone)) e.recipientPhone = 'We need their number for the delivery.';
      }
      if (notes.length > NOTES_MAX) e.notes = `Keep notes under ${NOTES_MAX} characters.`;
    }
    return e;
  };

  const ORDER = ['date', 'time', 'name', 'phone', 'address', 'landmark', 'recipientName', 'recipientPhone', 'notes'];
  const focusFirst = (e: Errors) => {
    const first = ORDER.find((k) => e[k]);
    if (!first) return;
    const id = first === 'time' ? (slots.length ? 'co-time' : 'co-date') : `co-${first}`;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const goTo = (s: Step) => {
    setStep(s);
    setFailure(null);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }));
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return focusFirst(e);
    goTo((step + 1) as Step);
  };

  const messageFor = (orderNumber?: string, totalAmount = total) =>
    buildOrderMessage({
      orderNumber,
      lines: lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, options: l.options, message: l.message })),
      total: totalAmount,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      orderType,
      date,
      time,
      address: address.trim(),
      landmark: landmark.trim(),
      pickupAddress: settings.pickupAddress,
      notes: notes.trim(),
      gift,
    });

  const place = async () => {
    for (const s of [1, 2] as Step[]) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        goTo(s);
        return focusFirst(e);
      }
    }
    setPlacing(true);
    setFailure(null);
    const slowTimer = window.setTimeout(() => setSlow(true), 6000);
    try {
      const { data } = await api.post<{ orderNumber: string; totalAmount: number }>('/orders', {
        clientRef: clientRef.current,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        orderType,
        deliveryDate: date,
        deliveryTime: time,
        deliveryLocation: orderType === 'delivery' ? address.trim() : undefined,
        landmark: orderType === 'delivery' && landmark.trim() ? landmark.trim() : undefined,
        notes: notes.trim() || undefined,
        gift,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          optionIds: l.options.map((o) => o.optionId),
          quantity: l.quantity,
          message: l.message || undefined,
        })),
      });

      saveCustomer({ name: name.trim(), phone: phone.trim(), orderType, address: address.trim(), landmark: landmark.trim() });
      const order: SavedOrder = {
        orderNumber: data.orderNumber,
        phone: phone.trim(),
        customerName: name.trim(),
        orderType,
        date,
        time,
        address: address.trim(),
        landmark: landmark.trim(),
        total: data.totalAmount ?? total,
        lines: lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          options: l.options.map((o) => ({ group: o.group, name: o.name })),
          message: l.message,
          section: l.section,
        })),
        gift,
        notes: notes.trim(),
        placedAt: new Date().toISOString(),
      };
      saveOrder(order);
      setPlaced(true);
      navigate(`/order/${encodeURIComponent(data.orderNumber)}`, { replace: true, state: { order, fresh: true } });
      clear();
    } catch (err) {
      setFailure(errorMessage(err, 'We couldn’t place your order just now.'));
    } finally {
      window.clearTimeout(slowTimer);
      setPlacing(false);
      setSlow(false);
    }
  };

  const err = (k: string) => errors[k];
  const clearErr = (k: string) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 md:pb-0">
      <div ref={top} className="scroll-mt-24" />
      <Link to="/menu" className="inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 text-sm font-semibold text-plum hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Keep shopping
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-plum sm:text-5xl">Checkout</h1>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="mx-auto max-w-md">
            <Progress step={step} onJump={goTo} />
          </div>

          <details className="group mt-6 rounded-lg bg-card p-4 shadow-soft ring-1 ring-crumb/60 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold">
              <span>
                Your bag · {bagCount(lines)} {bagCount(lines) === 1 ? 'treat' : 'treats'}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-plum">{formatMoney(total)}</span>
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="mt-2">
              <BagSummary lines={lines} total={total} />
            </div>
          </details>

          <div className="mt-6 rounded-xl bg-card p-5 shadow-soft ring-1 ring-crumb/60 sm:p-7" key={step}>
            <div className="animate-rise">
              {step === 1 && (
                <div className="space-y-8">
                  <fieldset>
                    <legend className="font-display text-2xl font-semibold text-plum">How would you like it?</legend>
                    <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pickup or delivery">
                      <ChoiceCard
                        on={orderType === 'pickup'}
                        onClick={() => setOrderType('pickup')}
                        icon={Store}
                        title="Pickup"
                        detail={settings.pickupAddress || 'Collect from our shop'}
                      />
                      <ChoiceCard
                        on={orderType === 'delivery'}
                        onClick={() => setOrderType('delivery')}
                        icon={Bike}
                        title="Delivery"
                        detail="We bring it to you. Fee agreed on WhatsApp."
                      />
                    </div>
                  </fieldset>

                  <div>
                    <h2 id="co-date-label" className="font-display text-2xl font-semibold text-plum">
                      Which day?
                    </h2>
                    <p className="mb-3 text-sm text-cocoa-soft">
                      {notice > 0 ? `Your treats need ${notice} ${notice === 1 ? 'day' : 'days'}’ notice, so the earliest is ${['Today', 'Tomorrow'].includes(friendlyDay(minDate)) ? friendlyDay(minDate).toLowerCase() : friendlyDay(minDate)}.` : 'Same-day orders welcome.'}
                    </p>
                    <DatePickerCards
                      id="co-date"
                      minDate={minDate}
                      value={date}
                      invalid={!!err('date')}
                      onChange={(d) => {
                        setDate(d);
                        clearErr('date');
                      }}
                    />
                    {err('date') && <p className="mt-1 text-sm font-medium text-berry">{err('date')}</p>}
                  </div>

                  <div>
                    <h2 id="co-time-label" className="font-display text-2xl font-semibold text-plum">
                      What time?
                    </h2>
                    {!date ? (
                      <p className="mt-2 flex items-center gap-2 rounded-md bg-cream-deep p-3 text-sm text-cocoa-soft">
                        <Clock className="size-4" aria-hidden /> Pick a day first and we’ll show the times.
                      </p>
                    ) : slots.length === 0 ? (
                      <p id="co-time-none" className="mt-2 rounded-md bg-honey-50 p-3 text-sm text-honey-700 ring-1 ring-honey-200">
                        We’re all booked up for the rest of today. Please choose another day.
                      </p>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="co-time-label">
                        {slots.map((s, i) => (
                          <button
                            key={s.label}
                            id={i === 0 ? 'co-time' : undefined}
                            type="button"
                            role="radio"
                            aria-checked={time === s.label}
                            onClick={() => {
                              setTime(s.label);
                              clearErr('time');
                            }}
                            className={cn(
                              'tabular min-h-11 rounded-full border-2 px-2 text-sm font-semibold transition active:scale-95',
                              time === s.label ? 'border-plum bg-plum text-cream' : 'border-crumb bg-card text-cocoa hover:border-plum/40',
                              err('time') && time !== s.label && 'border-berry/40'
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {err('time') && date && slots.length > 0 && <p className="mt-2 text-sm font-medium text-berry">{err('time')}</p>}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="font-display text-2xl font-semibold text-plum">Your details</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="co-name" label="Your name" error={err('name')}>
                      <Input {...describe('co-name', err('name'))} autoComplete="name" value={name} onChange={(e) => (setName(e.target.value), clearErr('name'))} />
                    </Field>
                    <Field id="co-phone" label="Phone number" error={err('phone')} hint="We’ll WhatsApp you about this order.">
                      <Input
                        {...describe('co-phone', err('phone'), true)}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="024 000 0000"
                        value={phone}
                        onChange={(e) => (setPhone(e.target.value), clearErr('phone'))}
                      />
                    </Field>
                  </div>

                  {orderType === 'delivery' && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field id="co-address" label={isGift ? 'Their delivery address' : 'Delivery address'} error={err('address')}>
                        <Input
                          {...describe('co-address', err('address'))}
                          autoComplete="street-address"
                          value={address}
                          onChange={(e) => (setAddress(e.target.value), clearErr('address'))}
                        />
                      </Field>
                      <Field id="co-landmark" label="Nearby landmark" optional error={err('landmark')}>
                        <Input
                          {...describe('co-landmark', err('landmark'))}
                          maxLength={120}
                          placeholder="Opposite the blue pharmacy"
                          value={landmark}
                          onChange={(e) => (setLandmark(e.target.value), clearErr('landmark'))}
                        />
                      </Field>
                    </div>
                  )}

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isGift}
                    onClick={() => setIsGift((g) => !g)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition',
                      isGift ? 'border-cherry/50 bg-cherry-50' : 'border-crumb bg-cream hover:border-plum/30'
                    )}
                  >
                    <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', isGift ? 'bg-cherry text-white' : 'bg-card text-plum shadow-soft')}>
                      <Gift className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-cocoa">This is a gift</span>
                      <span className="block text-sm text-cocoa-soft">We’ll deliver to them and add a card from you.</span>
                    </span>
                    <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', isGift ? 'bg-cherry' : 'bg-crumb-strong')} aria-hidden>
                      <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow-soft transition-all', isGift ? 'left-[22px]' : 'left-0.5')} />
                    </span>
                  </button>

                  {isGift && (
                    <div className="space-y-5 rounded-xl bg-cherry-50/50 p-4 ring-1 ring-cherry/15 animate-rise">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="co-recipientName" label="Their name" error={err('recipientName')}>
                          <Input
                            {...describe('co-recipientName', err('recipientName'))}
                            value={recipientName}
                            onChange={(e) => (setRecipientName(e.target.value), clearErr('recipientName'))}
                          />
                        </Field>
                        <Field id="co-recipientPhone" label="Their phone" error={err('recipientPhone')}>
                          <Input
                            {...describe('co-recipientPhone', err('recipientPhone'))}
                            type="tel"
                            inputMode="tel"
                            value={recipientPhone}
                            onChange={(e) => (setRecipientPhone(e.target.value), clearErr('recipientPhone'))}
                          />
                        </Field>
                      </div>
                      <Field id="co-card" label="Card message" optional counter={{ value: cardMessage.length, max: CARD_MAX }}>
                        <Textarea
                          id="co-card"
                          maxLength={CARD_MAX}
                          rows={3}
                          placeholder="Happy anniversary! Love, Kofi"
                          value={cardMessage}
                          onChange={(e) => setCardMessage(e.target.value.slice(0, CARD_MAX))}
                        />
                      </Field>
                      {orderType === 'pickup' && (
                        <p className="text-sm text-cocoa-soft">
                          You chose pickup. Want us to deliver it to them instead?{' '}
                          <button type="button" className="font-semibold text-plum underline underline-offset-2" onClick={() => setOrderType('delivery')}>
                            Switch to delivery
                          </button>
                        </p>
                      )}
                    </div>
                  )}

                  <Field id="co-notes" label="Anything else?" optional error={err('notes')} counter={{ value: notes.length, max: NOTES_MAX }}>
                    <Textarea
                      {...describe('co-notes', err('notes'))}
                      maxLength={NOTES_MAX}
                      rows={3}
                      placeholder="Allergies, colours, theme ideas…"
                      value={notes}
                      onChange={(e) => (setNotes(e.target.value.slice(0, NOTES_MAX)), clearErr('notes'))}
                    />
                  </Field>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="font-display text-2xl font-semibold text-plum">Check it over</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewBlock title={orderType === 'pickup' ? 'Pickup' : 'Delivery'} onEdit={() => goTo(1)}>
                      <p className="font-semibold">{date && formatDateLong(date)}</p>
                      <p>{time}</p>
                      {orderType === 'pickup' ? (
                        settings.pickupAddress && <p className="text-cocoa-soft">{settings.pickupAddress}</p>
                      ) : (
                        <p className="text-cocoa-soft">
                          {address}
                          {landmark && ` (near ${landmark})`}
                        </p>
                      )}
                    </ReviewBlock>
                    <ReviewBlock title="You" onEdit={() => goTo(2)}>
                      <p className="font-semibold">{name}</p>
                      <p>{phone}</p>
                      {notes && <p className="text-cocoa-soft">“{notes}”</p>}
                    </ReviewBlock>
                    {gift && (
                      <ReviewBlock title="Gift for" onEdit={() => goTo(2)}>
                        <p className="font-semibold">{gift.recipientName}</p>
                        <p>{gift.recipientPhone}</p>
                        {gift.message && <p className="text-cocoa-soft">Card: “{gift.message}”</p>}
                      </ReviewBlock>
                    )}
                  </div>
                  <div className="rounded-lg bg-cream p-4 ring-1 ring-crumb">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-cocoa-faint">Treats</h3>
                      <button
                        type="button"
                        onClick={() => useBag.getState().setOpen(true)}
                        className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-plum hover:bg-plum-50"
                      >
                        <Pencil className="size-3.5" aria-hidden /> Edit
                      </button>
                    </div>
                    <BagSummary lines={lines} total={total} />
                  </div>

                  {failure && (
                    <div role="alert" className="rounded-xl bg-berry-50 p-5 ring-1 ring-berry/20">
                      <div className="flex gap-3">
                        <AlertCircle className="mt-0.5 size-5 shrink-0 text-berry" aria-hidden />
                        <div>
                          <p className="font-semibold text-berry-700">Your order didn’t go through</p>
                          <p className="mt-0.5 text-sm text-cocoa-soft">{failure}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={place}>
                          Try again
                        </Button>
                        <a href={whatsappLink(settings.whatsappNumber, messageFor())} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'whatsapp' })}>
                          <WhatsAppIcon className="size-5" />
                          Send it on WhatsApp instead
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions: inline on desktop, a sticky bar on phones. */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-crumb bg-card/95 px-4 pt-3 pb-safe backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              {step > 1 && (
                <Button variant="outline" size="lg" onClick={() => goTo((step - 1) as Step)} disabled={placing} className="px-5">
                  <ArrowLeft className="size-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Back</span>
                </Button>
              )}
              {step < 3 ? (
                <Button size="lg" className="flex-1 md:ml-auto md:flex-none" onClick={next}>
                  Continue
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button size="lg" variant="cherry" className="flex-1 whitespace-normal text-center leading-tight md:ml-auto md:flex-none" onClick={place} loading={placing}>
                  {placing ? (slow ? 'Still baking… this can take up to a minute' : 'Placing your order…') : `Place order · ${formatMoney(total)}`}
                </Button>
              )}
            </div>
            {placing && slow && (
              <p role="status" className="sr-only">
                Still baking… this can take up to a minute.
              </p>
            )}
          </div>
        </div>

        <aside className="sticky top-[92px] hidden rounded-xl bg-card p-6 shadow-soft ring-1 ring-crumb/60 lg:block">
          <h2 className="font-display text-2xl font-semibold text-plum">Your bag</h2>
          <BagSummary lines={lines} total={total} />
        </aside>
      </div>
    </div>
  );
}
