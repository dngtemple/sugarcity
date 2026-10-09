import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Star, X } from 'lucide-react';
import { useMenu } from '../stores/menuStore';
import { useBag } from '../stores/bagStore';
import {
  chosenOptions,
  missingGroups,
  optionPriceLabel,
  SECTION_INFO,
  startingPrice,
  unitPrice,
  type MenuItem,
  type OptionGroup,
  type Selection,
} from '../lib/menu';
import { cn, formatMoney } from '../lib/utils';
import { Pill, Skeleton, TreatImage } from '../components/ui/bits';
import { Stepper } from '../components/ui/stepper';
import { Input } from '../components/ui/field';

const MESSAGE_MAX = 60;

function GroupBlock({
  item,
  group,
  selected,
  flagged,
  wobble,
  onToggle,
}: {
  item: MenuItem;
  group: OptionGroup;
  selected: string[];
  flagged: boolean;
  wobble: number;
  onToggle: (optionId: string) => void;
}) {
  const headId = `grp-${group._id}`;
  return (
    <section
      data-group={group._id}
      aria-labelledby={headId}
      className={cn('scroll-mt-4 rounded-lg p-4 transition-colors', flagged ? 'bg-berry-50 ring-2 ring-berry/40' : 'bg-card ring-1 ring-crumb/70')}
    >
      <div key={wobble} className={cn('flex w-fit flex-wrap items-center gap-2', flagged && wobble > 0 && 'animate-wobble')}>
        <h3 id={headId} className="font-semibold text-cocoa">
          {group.name}
        </h3>
        <span className="text-sm text-cocoa-faint">{group.multiple ? 'Pick any' : 'Pick 1'}</span>
        {group.required ? <Pill tone={flagged ? 'berry' : 'peach'}>Required</Pill> : <Pill tone="plum">Optional</Pill>}
      </div>
      {flagged && <p className="mt-1 text-sm font-medium text-berry">Choose one to continue.</p>}

      {group.multiple ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby={headId}>
          {group.options.map((o) => {
            const on = selected.includes(o._id);
            const price = optionPriceLabel(item, group, o, formatMoney);
            return (
              <button
                key={o._id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggle(o._id)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-[15px] transition active:scale-95',
                  on ? 'border-plum bg-plum text-cream' : 'border-crumb bg-cream text-cocoa hover:border-plum/40'
                )}
              >
                {on && <Check className="size-4" aria-hidden strokeWidth={3} />}
                <span className="font-medium">{o.name}</span>
                {price && <span className={cn('tabular text-sm', on ? 'text-peach' : 'text-cocoa-faint')}>{price}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-labelledby={headId} aria-required={group.required}>
          {group.options.map((o) => {
            const on = selected.includes(o._id);
            const price = optionPriceLabel(item, group, o, formatMoney);
            return (
              <button
                key={o._id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onToggle(o._id)}
                className={cn(
                  'relative flex min-h-[64px] flex-col items-start justify-center rounded-md border-2 px-3 py-2.5 text-left transition active:scale-[0.97]',
                  on ? 'border-plum bg-plum-50 shadow-ring' : 'border-crumb bg-cream hover:border-plum/40'
                )}
              >
                {on && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-plum text-cream shadow-soft" aria-hidden>
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
                <span className={cn('font-semibold leading-tight', on ? 'text-plum' : 'text-cocoa')}>{o.name}</span>
                {price && <span className="tabular mt-0.5 text-sm text-cocoa-soft">{price}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProductBody({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const add = useBag((s) => s.add);
  const [selection, setSelection] = useState<Selection>({});
  const [quantity, setQuantity] = useState(item.minQuantity);
  const [message, setMessage] = useState('');
  const [flagged, setFlagged] = useState<string[]>([]);
  const [wobble, setWobble] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const groups = item.optionGroups ?? [];
  const missing = missingGroups(item, selection);
  const ready = missing.length === 0;
  const unit = ready ? unitPrice(item, selection) : startingPrice(item).amount;
  const info = SECTION_INFO[item.section];

  const toggle = (group: OptionGroup, optionId: string) => {
    setSelection((prev) => {
      const current = prev[group._id] ?? [];
      let next: string[];
      if (group.multiple) next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId];
      else if (current.includes(optionId)) next = group.required ? current : [];
      else next = [optionId];
      return { ...prev, [group._id]: next };
    });
    setFlagged((f) => f.filter((id) => id !== group._id));
  };

  const submit = () => {
    if (!ready) {
      setFlagged(missing.map((g) => g._id));
      setWobble((n) => n + 1);
      const el = scroller.current?.querySelector<HTMLElement>(`[data-group="${missing[0]._id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
      return;
    }
    add({
      menuItemId: item._id,
      name: item.name,
      image: item.image,
      section: item.section,
      options: chosenOptions(item, selection),
      message: item.allowMessage ? message.trim() : '',
      unitPrice: unitPrice(item, selection),
      quantity,
      minQuantity: item.minQuantity,
      isGift: item.isGift,
    });
    toast.success('Added to your bag');
    onDone();
  };

  return (
    <>
      <div className="relative shrink-0 md:h-full md:w-[46%]">
        <TreatImage src={item.image} alt={item.name} section={item.section} className="aspect-[4/3] w-full md:aspect-auto md:h-full" iconClass="size-20" />
        {item.popular && (
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-full bg-cherry px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-soft">
            <Star className="size-3.5 fill-current" aria-hidden /> Customer favourite
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:w-[54%]">
        <div ref={scroller} className="flex-1 overflow-y-auto px-5 pb-6 pt-5 md:px-7 md:pt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cherry">
            {info.label} · {item.category}
          </p>
          <Dialog.Title className="mt-1 pr-10 font-display text-3xl font-semibold leading-tight text-plum">{item.name}</Dialog.Title>
          <p className="tabular mt-1 text-lg font-semibold text-cocoa">
            {!ready && startingPrice(item).from && <span className="mr-1 text-sm font-medium text-cocoa-faint">from</span>}
            {formatMoney(unit)}
            {item.minQuantity > 1 && <span className="ml-2 text-sm font-normal text-cocoa-faint">each · minimum {item.minQuantity}</span>}
          </p>
          {item.description ? (
            <Dialog.Description className="mt-3 whitespace-pre-line text-cocoa-soft">{item.description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Choose your options and add {item.name} to your bag.</Dialog.Description>
          )}

          {groups.length > 0 && (
            <div className="mt-6 space-y-3">
              {groups.map((g) => (
                <GroupBlock
                  key={g._id}
                  item={item}
                  group={g}
                  selected={selection[g._id] ?? []}
                  flagged={flagged.includes(g._id)}
                  wobble={flagged[0] === g._id ? wobble : 0}
                  onToggle={(id) => toggle(g, id)}
                />
              ))}
            </div>
          )}

          {item.allowMessage && (
            <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-crumb/70">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="treat-message" className="font-semibold text-cocoa">
                  Message on the {item.section === 'cakes' ? 'cake' : 'box'} <span className="font-normal text-cocoa-faint">optional</span>
                </label>
                <span className="tabular text-xs text-cocoa-faint" aria-live="polite">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <Input
                id="treat-message"
                className="mt-2"
                value={message}
                maxLength={MESSAGE_MAX}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                placeholder="Happy birthday, Ama!"
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-crumb bg-card px-5 pt-3 pb-safe md:px-7 md:pb-4">
          <Stepper value={quantity} min={item.minQuantity} onChange={setQuantity} label="Quantity" />
          <button
            type="button"
            onClick={submit}
            aria-disabled={!ready}
            className={cn(
              'flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold transition active:scale-[0.98] min-[400px]:gap-2 min-[400px]:px-4',
              ready ? 'bg-plum text-cream shadow-soft hover:bg-plum-700' : 'bg-plum/45 text-cream'
            )}
          >
            <span className="min-[400px]:hidden">Add</span>
            <span className="hidden min-[400px]:inline">Add to bag</span>
            <span aria-hidden>·</span>
            <span className="tabular">
              {!ready && <span className="hidden min-[400px]:inline">from </span>}
              {formatMoney(unit * quantity)}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

export default function ProductDialog() {
  const { section, itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, items } = useMenu();
  const item = items.find((i) => i._id === itemId);

  const close = () => {
    if ((location.state as { modal?: boolean } | null)?.modal) navigate(-1);
    else navigate(`/menu/${section}`, { replace: true });
  };

  const missing = status === 'ready' && !item;
  useEffect(() => {
    if (missing) toast('That treat isn’t on the menu right now.', { id: 'missing-item' });
  }, [missing]);

  if (missing) return <Navigate to={`/menu/${section}`} replace />;
  // Opened from another collection's URL: send it to its own.
  if (item && item.section !== section) return <Navigate to={`/menu/${item.section}/${item._id}`} replace state={location.state} />;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-plum-900/50 backdrop-blur-sm animate-fade" />
        <Dialog.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-hidden bg-cream focus:outline-none animate-sheet-up',
            'md:inset-0 md:m-auto md:h-[min(680px,90vh)] md:w-[min(980px,calc(100%-3rem))] md:flex-row md:rounded-2xl md:shadow-lift md:animate-zoom'
          )}
        >
          <Dialog.Close
            className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-card/95 text-cocoa shadow-soft backdrop-blur hover:bg-card"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          {item ? (
            <ProductBody key={item._id} item={item} onDone={close} />
          ) : status === 'error' ? (
            <div className="m-auto max-w-sm p-8 text-center">
              <Dialog.Title className="font-display text-2xl font-semibold text-plum">We couldn’t load this treat</Dialog.Title>
              <Dialog.Description className="mt-2 text-cocoa-soft">Check your connection and try again.</Dialog.Description>
              <button type="button" onClick={() => useMenu.getState().load()} className="mt-5 h-12 rounded-full bg-plum px-6 font-semibold text-cream">
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col md:flex-row" aria-busy>
              <Dialog.Title className="sr-only">Loading</Dialog.Title>
              <Dialog.Description className="sr-only">Fetching this treat</Dialog.Description>
              <Skeleton className="aspect-[4/3] w-full rounded-none md:aspect-auto md:h-full md:w-[46%]" />
              <div className="flex-1 space-y-3 p-6">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-9 w-2/3" />
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-28 w-full" />
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
