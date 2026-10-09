import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Scale, Trash } from 'lucide-react';
import { MOVEMENT_LABEL, formatDelta, formatQty, stockLevel, type InventoryItem, type StockMovement } from '../../lib/inventory';
import { cn, formatDateTime, formatMoney } from '../../lib/utils';
import { Pill } from '../ui/Bits';

/** On-hand amount coloured by level: berry when out, honey when low, mint otherwise. */
export function StockQty({ item, className }: { item: InventoryItem; className?: string }) {
  const level = stockLevel(item);
  return (
    <span
      className={cn(
        'font-semibold tabular',
        !item.active ? 'text-cocoa-faint' : level === 'out' ? 'text-berry' : level === 'low' ? 'text-honey-700' : 'text-mint-700',
        className
      )}
    >
      {formatQty(item.onHand, item.unit)}
    </span>
  );
}

export function StockFlag({ item }: { item: InventoryItem }) {
  if (!item.active) return <Pill tone="neutral">Archived</Pill>;
  const level = stockLevel(item);
  if (level === 'out') return <Pill tone="berry">Out</Pill>;
  if (level === 'low') return <Pill tone="honey">Running low</Pill>;
  return null;
}

const ICONS = { receive: ArrowDownLeft, use: ArrowUpRight, waste: Trash, count: ClipboardCheck, adjust: Scale };
const TONES = {
  receive: 'bg-mint-50 text-mint',
  use: 'bg-sky-50 text-sky-700',
  waste: 'bg-berry-50 text-berry',
  count: 'bg-plum-50 text-plum',
  adjust: 'bg-peach-50 text-peach-700',
};

/** One line of stock history. */
export function MovementLine({ m, showItem = true }: { m: StockMovement; showItem?: boolean }) {
  const Icon = ICONS[m.type] ?? Scale;
  const details = [m.reference, m.supplier, m.note].filter(Boolean).join(' · ');
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', TONES[m.type])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-cocoa">
          {MOVEMENT_LABEL[m.type]}
          {showItem && <span className="font-normal text-cocoa-soft"> · {m.itemName}</span>}
        </p>
        {details && <p className="truncate text-sm text-cocoa-soft">{details}</p>}
        <p className="text-xs text-cocoa-faint">
          {formatDateTime(m.createdAt)}
          {m.actorName ? ` · ${m.actorName}` : ''}
          {m.unitCost ? ` · ${formatMoney(m.unitCost)}/${m.unit}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('font-semibold tabular', m.quantity > 0 ? 'text-mint-700' : m.quantity < 0 ? 'text-berry' : 'text-cocoa-soft')}>{formatDelta(m.quantity, m.unit)}</p>
        <p className="text-xs tabular text-cocoa-faint">now {formatQty(m.balanceAfter, m.unit)}</p>
      </div>
    </li>
  );
}
