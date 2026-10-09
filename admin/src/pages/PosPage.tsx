import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, PenLine, Receipt, ShoppingBasket, Store, Trash2, Truck, UserRound } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { cachedGet } from '../lib/cache';
import { notifyOrdersChanged } from '../lib/events';
import { useIsDesktop } from '../lib/hooks';
import { useShopSettings } from '../lib/useSettings';
import { COLLECTIONS, COLLECTION_INFO, startingPrice, type Collection, type MenuItem } from '../lib/menu';
import { cn, dateKey, formatMoney, plural, timeSlots } from '../lib/utils';
import { Empty, FilterPills, LoadError, PageTitle, Segmented, Skeleton, Stepper } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Input, SearchInput, Select, Textarea } from '../components/ui/Field';
import { DatePicker } from '../components/ui/DatePicker';
import { Overlay } from '../components/ui/Overlay';
import { SwitchRow } from '../components/ui/Switch';
import { OptionChooser, type PickedLine } from '../components/orders/OptionChooser';

interface Line {
  key: string;
  menuItemId?: string;
  custom?: boolean;
  name: string;
  options: PickedLine['options'];
  message: string;
  unitPrice: number;
  quantity: number;
}

interface Customer {
  type: 'pickup' | 'delivery';
  name: string;
  phone: string;
  date: string;
  time: string;
  address: string;
  landmark: string;
  notes: string;
}

const ANY_TIME = '__any__';

const lineKey = (l: Omit<Line, 'key'>) =>
  l.custom
    ? `custom|${l.name.toLowerCase()}|${l.unitPrice}`
    : [l.menuItemId, ...l.options.map((o) => o.optionId).sort(), l.message.toLowerCase()].join('|');

type Tab = 'all' | Collection;

export function PosPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const settings = useShopSettings();
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [menuError, setMenuError] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [choosing, setChoosing] = useState<MenuItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer>({ type: 'pickup', name: '', phone: '', date: dateKey(), time: ANY_TIME, address: '', landmark: '', notes: '' });
  const [paid, setPaid] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'items' | 'phone' | 'address', string>>>({});
  const [saving, setSaving] = useState(false);

  const loadMenu = () =>
    cachedGet<{ items: MenuItem[] }>('/menu/all')
      .then((d) => {
        setMenu(d.items.filter((i) => i.available));
        setMenuError(false);
      })
      .catch(() => setMenuError(true));

  useEffect(() => {
    void loadMenu();
  }, []);

  const counts = useMemo(() => Object.fromEntries(COLLECTIONS.map((c) => [c, (menu ?? []).filter((i) => i.section === c).length])) as Record<Collection, number>, [menu]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (menu ?? []).filter((i) => (tab === 'all' || i.section === tab) && (!q || `${i.name} ${i.category}`.toLowerCase().includes(q)));
  }, [menu, tab, query]);

  const addLine = (line: Omit<Line, 'key'>) => {
    const key = lineKey(line);
    setLines((prev) =>
      prev.some((l) => l.key === key)
        ? prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(1000, l.quantity + line.quantity) } : l))
        : [...prev, { ...line, key }]
    );
    setErrors((e) => ({ ...e, items: undefined }));
  };

  const tap = (item: MenuItem) => {
    if (!item.optionGroups?.length && !item.allowMessage) {
      addLine({ menuItemId: item._id, name: item.name, options: [], message: '', unitPrice: item.price, quantity: Math.max(1, item.minQuantity || 1) });
      toast.success(`${item.name} added`, { id: 'pos-add', duration: 1500 });
    } else {
      setChoosing(item);
    }
  };

  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  const save = async () => {
    const e: typeof errors = {};
    if (lines.length === 0) e.items = 'Add at least one item to the ticket.';
    const digits = customer.phone.replace(/\D/g, '').length;
    if (customer.phone.trim() && (digits < 9 || digits > 15)) e.phone = 'That phone number looks short. Fix it, or leave it empty.';
    if (customer.type === 'delivery' && !customer.address.trim()) e.address = 'Where should it be delivered?';
    setErrors(e);
    if (Object.keys(e).length) {
      if (!isDesktop) setTicketOpen(true);
      toast.error(e.items ?? e.phone ?? e.address ?? 'Check the ticket.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<{ _id: string; orderNumber: string }>('/orders/walkin', {
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        orderType: customer.type,
        deliveryDate: customer.date || dateKey(),
        deliveryTime: customer.time === ANY_TIME ? '' : customer.time,
        deliveryLocation: customer.type === 'delivery' ? customer.address.trim() : '',
        landmark: customer.type === 'delivery' ? customer.landmark.trim() : '',
        notes: customer.notes.trim(),
        paid,
        completed: handedOver,
        items: lines.map((l) =>
          l.custom
            ? { custom: true, name: l.name, price: l.unitPrice, quantity: l.quantity }
            : { menuItemId: l.menuItemId, optionIds: l.options.map((o) => o.optionId), quantity: l.quantity, message: l.message }
        ),
      });
      notifyOrdersChanged();
      toast.success(`Sale ${data.orderNumber} saved`);
      navigate(`/orders/${data._id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save the sale. Nothing was lost — try again.'));
      setSaving(false);
    }
  };

  const ticket = (
    <Ticket
      lines={lines}
      setLines={setLines}
      total={total}
      customer={customer}
      setCustomer={(patch) => {
        setCustomer((c) => ({ ...c, ...patch }));
        setErrors((x) => ({ ...x, phone: patch.phone !== undefined ? undefined : x.phone, address: patch.address !== undefined ? undefined : x.address }));
      }}
      slots={timeSlots(settings.openHour, settings.closeHour)}
      paid={paid}
      setPaid={setPaid}
      handedOver={handedOver}
      setHandedOver={setHandedOver}
      errors={errors}
      saving={saving}
      onSave={save}
    />
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-4 pb-24 lg:pb-0">
          <PageTitle title="New sale" description="Tap treats to add them to the ticket. Counter and phone orders both go here." />
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <FilterPills
              label="Collection"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'all' as Tab, label: 'Everything', count: menu?.length },
                ...COLLECTIONS.map((c) => ({ value: c as Tab, label: COLLECTION_INFO[c].short, count: menu ? counts[c] : undefined })),
              ]}
              className="xl:flex-1"
            />
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a treat" aria-label="Search the menu" className="xl:w-64" />
          </div>

          {menuError ? (
            <LoadError message="We couldn’t load the menu." onRetry={() => void loadMenu()} />
          ) : !menu ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/5]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-plum-200 bg-plum-50/60 p-3 text-center text-plum transition-colors hover:border-plum hover:bg-plum-50"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-card shadow-soft">
                  <PenLine className="size-5" aria-hidden />
                </span>
                <span className="font-display text-base font-semibold">Custom item</span>
                <span className="text-xs text-cocoa-soft">Anything not on the menu</span>
              </button>
              {shown.map((item) => (
                <MenuTile key={item._id} item={item} onTap={() => tap(item)} />
              ))}
              {shown.length === 0 && (
                <div className="col-span-full">
                  <Empty icon={<ShoppingBasket />} title="Nothing matches" body={query ? `No treats match “${query}”.` : 'This collection has nothing on sale right now.'} />
                </div>
              )}
            </div>
          )}
        </div>

        {isDesktop && <aside className="sticky top-6 h-fit">{ticket}</aside>}
      </div>

      {!isDesktop && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-crumb bg-cream/95 px-4 pt-3 pb-safe backdrop-blur">
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="flex min-h-14 w-full items-center gap-3 rounded-full bg-plum px-5 text-cream shadow-lift active:scale-[0.99]"
            >
              <Receipt className="size-5 shrink-0" aria-hidden />
              <span className="flex-1 text-left font-semibold tabular">
                {plural(count, 'item')} · {formatMoney(total)}
              </span>
              <span className="text-sm font-semibold text-peach">View ticket</span>
            </button>
          </div>
          <Overlay open={ticketOpen} onOpenChange={setTicketOpen} title="Ticket" kind="right" bodyClassName="bg-cream-deep/50 px-3 sm:px-4">
            {ticket}
          </Overlay>
        </>
      )}

      <OptionChooser item={choosing} onClose={() => setChoosing(null)} onAdd={(l) => { addLine(l); toast.success(`${l.name} added`, { id: 'pos-add', duration: 1500 }); }} />
      <CustomItemDialog open={customOpen} onOpenChange={setCustomOpen} onAdd={(l) => addLine(l)} />
    </div>
  );
}

function MenuTile({ item, onTap }: { item: MenuItem; onTap: () => void }) {
  const Icon = COLLECTION_INFO[item.section]?.icon ?? ShoppingBasket;
  const price = startingPrice(item);
  const hasChoices = !!item.optionGroups?.length || item.allowMessage;
  return (
    <button
      type="button"
      onClick={onTap}
      className="group flex flex-col overflow-hidden rounded-xl border border-crumb bg-card text-left shadow-soft transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-peach-50">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex size-full items-center justify-center text-peach-700">
            <Icon className="size-9" aria-hidden />
          </span>
        )}
        {hasChoices && <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-plum">Choices</span>}
      </span>
      <span className="flex flex-1 flex-col gap-0.5 p-3">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-cocoa">{item.name}</span>
        <span className="mt-auto pt-1 text-sm font-semibold tabular text-plum">
          {price.from && <span className="font-normal text-cocoa-faint">from </span>}
          {formatMoney(price.amount)}
        </span>
      </span>
    </button>
  );
}

function Ticket({
  lines,
  setLines,
  total,
  customer,
  setCustomer,
  slots,
  paid,
  setPaid,
  handedOver,
  setHandedOver,
  errors,
  saving,
  onSave,
}: {
  lines: Line[];
  setLines: Dispatch<SetStateAction<Line[]>>;
  total: number;
  customer: Customer;
  setCustomer: (patch: Partial<Customer>) => void;
  slots: string[];
  paid: boolean;
  setPaid: (v: boolean) => void;
  handedOver: boolean;
  setHandedOver: (v: boolean) => void;
  errors: Partial<Record<'items' | 'phone' | 'address', string>>;
  saving: boolean;
  onSave: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showDetails = detailsOpen || !!errors.phone || !!errors.address || customer.type === 'delivery';
  const summary = [customer.name.trim() || 'Walk-in customer', customer.type === 'delivery' ? 'Delivery' : 'Pickup'].join(' · ');

  return (
    <div className="space-y-3">
      <div className="edge-scallop rounded-b-xl bg-card pt-5 shadow-soft">
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-center justify-between border-b-2 border-dashed border-crumb pb-3">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-plum">
              <Receipt className="size-5" aria-hidden /> Ticket
            </h2>
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines([])} className="min-h-11 rounded-full px-3 text-sm font-semibold text-cocoa-faint hover:bg-berry-50 hover:text-berry">
                Clear
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <p className={cn('py-8 text-center text-[15px]', errors.items ? 'font-semibold text-berry' : 'text-cocoa-faint')}>
              {errors.items ?? 'Nothing on the ticket yet.'}
            </p>
          ) : (
            <ul className="ticket-paper divide-y divide-dashed divide-crumb">
              {lines.map((l) => (
                <li key={l.key} className="py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-cocoa">
                        {l.name}
                        {l.custom && <span className="ml-1.5 text-xs font-medium text-cocoa-faint">custom</span>}
                      </p>
                      {l.options.length > 0 && <p className="text-sm text-cocoa-soft">{l.options.map((o) => o.name).join(' · ')}</p>}
                      {l.message && <p className="text-sm text-peach-700">“{l.message}”</p>}
                    </div>
                    <p className="font-semibold tabular text-cocoa">{formatMoney(l.unitPrice * l.quantity)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs tabular text-cocoa-faint">{formatMoney(l.unitPrice)} each</span>
                    <div className="flex items-center gap-1">
                      <Stepper value={l.quantity} onChange={(n) => setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, quantity: n } : x)))} label={l.name} />
                      <IconButton label={`Remove ${l.name}`} tone="danger" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex items-baseline justify-between border-t-2 border-plum-100 pt-3">
            <span className="font-display text-lg font-semibold text-cocoa">Total</span>
            <span className="font-display text-3xl font-semibold tabular text-plum">{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="sc-card overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={showDetails}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left sm:px-5"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-plum-50 text-plum">
            <UserRound className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-cocoa">Customer & collection</span>
            <span className="block truncate text-sm text-cocoa-soft">{summary}</span>
          </span>
          <ChevronDown className={cn('size-5 text-cocoa-faint transition-transform', showDetails && 'rotate-180')} aria-hidden />
        </button>
        {showDetails && (
          <div className="space-y-4 border-t border-crumb px-4 py-4 sm:px-5">
            <Segmented
              label="Pickup or delivery"
              value={customer.type}
              onChange={(type) => setCustomer({ type })}
              className="flex w-full"
              items={[
                { value: 'pickup', label: <><Store /> Pickup</> },
                { value: 'delivery', label: <><Truck /> Delivery</> },
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Name" htmlFor="pos-name" optional>
                <Input id="pos-name" value={customer.name} onChange={(e) => setCustomer({ name: e.target.value })} placeholder="Walk-in customer" autoComplete="off" maxLength={80} />
              </Field>
              <Field label="Phone" htmlFor="pos-phone" optional error={errors.phone}>
                <Input id="pos-phone" type="tel" inputMode="tel" value={customer.phone} invalid={!!errors.phone} onChange={(e) => setCustomer({ phone: e.target.value })} placeholder="024 000 0000" autoComplete="off" />
              </Field>
              <Field label="Date" htmlFor="pos-date">
                <DatePicker id="pos-date" value={customer.date} onChange={(date) => setCustomer({ date })} />
              </Field>
              <Field label="Time" htmlFor="pos-time">
                <Select id="pos-time" value={customer.time} onChange={(time) => setCustomer({ time })} options={[{ value: ANY_TIME, label: 'Any time' }, ...slots.map((s) => ({ value: s, label: s }))]} />
              </Field>
            </div>
            {customer.type === 'delivery' && (
              <div className="grid gap-3">
                <Field label="Delivery address" htmlFor="pos-address" error={errors.address}>
                  <Input id="pos-address" value={customer.address} invalid={!!errors.address} onChange={(e) => setCustomer({ address: e.target.value })} placeholder="House number, street, area" maxLength={200} />
                </Field>
                <Field label="Landmark" htmlFor="pos-landmark" optional>
                  <Input id="pos-landmark" value={customer.landmark} onChange={(e) => setCustomer({ landmark: e.target.value })} placeholder="e.g. Opposite the blue pharmacy" maxLength={120} />
                </Field>
              </div>
            )}
            <Field label="Notes" htmlFor="pos-notes" optional>
              <Textarea id="pos-notes" value={customer.notes} onChange={(e) => setCustomer({ notes: e.target.value })} className="min-h-20" maxLength={500} placeholder="Anything the kitchen should know" />
            </Field>
          </div>
        )}
      </div>

      <div className="sc-card divide-y divide-crumb px-4 sm:px-5">
        <SwitchRow id="pos-paid" title="Paid" description={paid ? 'Money received' : 'Collect payment later'} checked={paid} onCheckedChange={setPaid} />
        <SwitchRow
          id="pos-done"
          title="Handed over now"
          description={handedOver ? 'Saved as completed' : 'Goes on the board as New'}
          checked={handedOver}
          onCheckedChange={setHandedOver}
        />
      </div>

      <Button size="lg" variant="cherry" block loading={saving} onClick={onSave} disabled={lines.length === 0 && !errors.items}>
        Save sale · {formatMoney(total)}
      </Button>
    </div>
  );
}

function CustomItemDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (line: Omit<Line, 'key'>) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<{ name?: string; price?: string }>({});

  const reset = () => {
    setName('');
    setPrice('');
    setQty(1);
    setError({});
  };

  const submit = () => {
    const p = Number(price.replace(',', '.'));
    const e: typeof error = {};
    if (!name.trim()) e.name = 'What is it?';
    if (!price.trim() || !Number.isFinite(p) || p < 0) e.price = 'Enter the price for one.';
    setError(e);
    if (Object.keys(e).length) return;
    onAdd({ custom: true, name: name.trim(), options: [], message: '', unitPrice: Math.round(p * 100) / 100, quantity: qty });
    toast.success(`${name.trim()} added`, { id: 'pos-add', duration: 1500 });
    reset();
    onOpenChange(false);
  };

  return (
    <Overlay
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Custom item"
      description="For anything that isn’t on the menu"
      footer={
        <Button size="lg" block onClick={submit}>
          Add to ticket{price && Number.isFinite(Number(price)) ? ` · ${formatMoney(Number(price) * qty)}` : ''}
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" htmlFor="custom-name" error={error.name}>
          <Input id="custom-name" value={name} invalid={!!error.name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Extra candles" maxLength={80} autoFocus />
        </Field>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Price each (GH₵)" htmlFor="custom-price" error={error.price} className="w-40">
            <Input id="custom-price" inputMode="decimal" value={price} invalid={!!error.price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </Field>
          <div>
            <span className="sc-label">Quantity</span>
            <Stepper value={qty} onChange={setQty} label="quantity" />
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Overlay>
  );
}
