import { useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  chosenOptions,
  missingGroups,
  optionPriceLabel,
  ruleShort,
  unitPrice,
  type MenuItem,
  type OptionGroup,
  type Selection,
} from '../../lib/menu';
import { cn, formatMoney } from '../../lib/utils';
import { Overlay } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Pill, Stepper } from '../ui/Bits';
import { Input } from '../ui/Field';

export interface PickedLine {
  menuItemId: string;
  name: string;
  options: ReturnType<typeof chosenOptions>;
  message: string;
  unitPrice: number;
  quantity: number;
}

/** One choosable tile — the same look customers get on the website. */
export function OptionTile({
  multiple,
  checked,
  name,
  price,
  onToggle,
  groupName,
  readOnly,
}: {
  multiple: boolean;
  checked: boolean;
  name: ReactNode;
  price?: string;
  onToggle?: () => void;
  groupName?: string;
  readOnly?: boolean;
}) {
  const box = (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center border-2 transition-colors',
        multiple ? 'rounded-md' : 'rounded-full',
        checked ? 'border-plum bg-plum text-cream' : 'border-crumb-strong bg-card'
      )}
    >
      {checked && (multiple ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2.5 rounded-full bg-cream" />)}
    </span>
  );
  const body = (
    <>
      {box}
      <span className="min-w-0 flex-1 text-[15px] font-medium text-cocoa">{name}</span>
      {price && <span className={cn('shrink-0 text-sm font-semibold tabular', checked ? 'text-plum' : 'text-cocoa-soft')}>{price}</span>}
    </>
  );
  const cls = cn(
    'flex min-h-14 items-center gap-3 rounded-lg border-2 px-3.5 py-2 transition-colors',
    checked ? 'border-plum bg-plum-50' : 'border-crumb bg-card',
    !readOnly && 'cursor-pointer hover:border-plum-200 has-[:focus-visible]:shadow-ring'
  );
  if (readOnly) return <div className={cls}>{body}</div>;
  return (
    <label className={cls}>
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={groupName}
        checked={checked}
        onChange={() => onToggle?.()}
        onClick={(e) => {
          // A second tap on an optional single choice clears it.
          if (!multiple && checked) {
            e.preventDefault();
            onToggle?.();
          }
        }}
        className="sr-only"
      />
      {body}
    </label>
  );
}

/** Pick options, message and quantity for one menu item at the counter. */
export function OptionChooser({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (line: PickedLine) => void }) {
  return (
    <Overlay open={!!item} onOpenChange={(o) => !o && onClose()} title={item?.name ?? ''} description={item?.category}>
      {item && <ChooserBody key={item._id} item={item} onClose={onClose} onAdd={onAdd} />}
    </Overlay>
  );
}

function ChooserBody({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (line: PickedLine) => void }) {
  const [selection, setSelection] = useState<Selection>({});
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(Math.max(1, item.minQuantity || 1));
  const [flag, setFlag] = useState(false);
  const refs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const missing = missingGroups(item, selection);

  const toggle = (group: OptionGroup, optionId: string) => {
    const gid = group._id!;
    setSelection((s) => {
      const current = s[gid] ?? [];
      if (group.multiple) return { ...s, [gid]: current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId] };
      if (current[0] === optionId) return group.required ? s : { ...s, [gid]: [] };
      return { ...s, [gid]: [optionId] };
    });
  };

  const add = () => {
    if (missing.length) {
      setFlag(true);
      refs.current[missing[0]._id!]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onAdd({
      menuItemId: item._id,
      name: item.name,
      options: chosenOptions(item, selection),
      message: item.allowMessage ? message.trim() : '',
      unitPrice: unitPrice(item, selection),
      quantity,
    });
    onClose();
  };

  return (
    <div className="space-y-6">
      {(item.optionGroups ?? []).map((group, gi) => {
        const picked = selection[group._id!] ?? [];
        const flagged = flag && group.required && picked.length === 0;
        return (
          <fieldset key={group._id} ref={(el) => { refs.current[group._id!] = el; }}>
            <legend className="mb-2.5 flex w-full items-center gap-2">
              <span className="font-display text-lg font-semibold text-cocoa">{group.name}</span>
              <Pill tone={flagged ? 'berry' : group.required ? 'plum' : 'neutral'}>{ruleShort(group)}</Pill>
            </legend>
            {flagged && <p className="mb-2 text-sm font-semibold text-berry">Choose {group.multiple ? 'at least one' : 'one'} to continue.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {group.options.map((o) => (
                <OptionTile
                  key={o._id}
                  groupName={group._id}
                  multiple={group.multiple}
                  checked={picked.includes(o._id!)}
                  name={o.name}
                  price={optionPriceLabel(item, gi, o, formatMoney)}
                  onToggle={() => toggle(group, o._id!)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}

      {item.allowMessage && (
        <div>
          <label htmlFor="chooser-message" className="sc-label">
            Message on the cake/box <span className="font-normal text-cocoa-faint">optional</span>
          </label>
          <Input id="chooser-message" value={message} maxLength={60} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Happy 30th, Efua!" />
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 -mb-5 flex items-center gap-3 border-t border-crumb bg-card px-4 py-3 sm:-mx-5 sm:px-5">
        <Stepper value={quantity} onChange={setQuantity} label="quantity" />
        <Button size="lg" className="flex-1" onClick={add}>
          {missing.length ? `Choose ${missing[0].name.toLowerCase()}` : `Add · ${formatMoney(unitPrice(item, selection) * quantity)}`}
        </Button>
      </div>
    </div>
  );
}
