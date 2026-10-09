import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardCheck, History, Pencil, QrCode } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { cachedGet } from '../../lib/cache';
import { notifyInventoryChanged } from '../../lib/events';
import { formatQty, isMeasured, parseQty, type InventoryItem, type ItemPatch, type StockMovement } from '../../lib/inventory';
import { formatDateTime, formatMoney } from '../../lib/utils';
import { Overlay } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { buttonClass } from '../ui/buttonStyles';
import { Skeleton } from '../ui/Bits';
import { Field, Input } from '../ui/Field';
import { MovementLine, StockFlag, StockQty } from './StockBits';

const RECENT = 20;

/** One stock item: how much there is, its facts, what happened to it lately. */
export function ItemDrawer({
  item,
  onClose,
  onEdit,
  onPatched,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onPatched: (patch: ItemPatch) => void;
}) {
  return (
    <Overlay open={!!item} onOpenChange={(o) => !o && onClose()} kind="right" title={item?.name ?? ''} description={item?.category || 'Stock item'}>
      {item && <DrawerBody key={item._id} item={item} onEdit={onEdit} onPatched={onPatched} />}
    </Overlay>
  );
}

function DrawerBody({ item, onEdit, onPatched }: { item: InventoryItem; onEdit: (item: InventoryItem) => void; onPatched: (patch: ItemPatch) => void }) {
  const [history, setHistory] = useState<StockMovement[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const loadHistory = useCallback(
    (force = false) =>
      cachedGet<{ movements: StockMovement[] }>('/inventory/movements', { params: { item: item._id, limit: RECENT } }, { force })
        .then((d) => {
          setHistory(d.movements);
          setHistoryError(false);
        })
        .catch(() => setHistoryError(true)),
    [item._id]
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const facts: [string, string][] = [
    ['Label code', item.sku],
    ['Warn at', item.reorderLevel > 0 ? formatQty(item.reorderLevel, item.unit) : 'Not set'],
    ['Average cost', item.avgCost > 0 ? `${formatMoney(item.avgCost)} / ${item.unit}` : 'Not recorded'],
    ['Stock value', item.avgCost > 0 && item.onHand > 0 ? formatMoney(item.onHand * item.avgCost) : '—'],
    ['Location', item.location || '—'],
    ['Supplier', item.supplier || '—'],
    ['Last counted', item.lastCountedAt ? formatDateTime(item.lastCountedAt) : 'Never'],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-plum-900 bg-sprinkles p-5 text-cream">
        <p className="text-sm text-cream/70">On the shelf</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StockQty item={item} className="font-display text-4xl text-cream" />
          <StockFlag item={item} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setCorrecting(true)} disabled={!item.active}>
          <ClipboardCheck /> Correct stock
        </Button>
        <Button variant="outline" onClick={() => onEdit(item)}>
          <Pencil /> Edit
        </Button>
        <Link to={`/inventory/labels?ids=${item._id}`} className={buttonClass('outline', 'md', 'col-span-2')}>
          <QrCode /> Print label
        </Link>
      </div>

      <dl className="divide-y divide-crumb rounded-lg border border-crumb bg-card">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-[15px]">
            <dt className="text-cocoa-faint">{label}</dt>
            <dd className="text-right font-medium text-cocoa">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 px-4 py-2.5 text-[15px]">
          <dt className="text-cocoa-faint">Barcodes</dt>
          <dd className="text-right font-mono text-sm text-cocoa">
            {item.barcodes.length ? item.barcodes.map((c) => <span key={c} className="block">{c}</span>) : <span className="font-sans text-cocoa-faint">None — use the QR label</span>}
          </dd>
        </div>
      </dl>

      {item.notes && <p className="whitespace-pre-line rounded-lg bg-honey-50 px-4 py-3 text-[15px] text-cocoa">{item.notes}</p>}

      <section>
        <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-cocoa">
          <History className="size-4 text-plum" aria-hidden /> Recent movements
        </h3>
        {historyError ? (
          <p className="text-sm text-cocoa-soft">
            Couldn’t load the history.{' '}
            <button type="button" className="sc-link" onClick={() => void loadHistory(true)}>
              Try again
            </button>
          </p>
        ) : !history ? (
          <Skeleton className="h-28" />
        ) : history.length === 0 ? (
          <p className="text-sm text-cocoa-soft">Nothing has moved yet.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-crumb sm:-mx-5">
            {history.map((m) => (
              <MovementLine key={m._id} m={m} showItem={false} />
            ))}
          </ul>
        )}
      </section>

      <CorrectStockDialog
        key={`${correcting}-${item.onHand}`}
        open={correcting}
        item={item}
        onClose={() => setCorrecting(false)}
        onDone={(patch) => {
          setCorrecting(false);
          onPatched(patch);
          void loadHistory(true);
        }}
      />
    </div>
  );
}

function CorrectStockDialog({ open, item, onClose, onDone }: { open: boolean; item: InventoryItem; onClose: () => void; onDone: (p: ItemPatch) => void }) {
  const [counted, setCounted] = useState(String(Math.max(item.onHand, 0)));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = parseQty(counted);
    if (Number.isNaN(n) || n < 0) return setError('Enter how many there are — 0 or more.');
    setSaving(true);
    try {
      const { data } = await api.post<{ items: ItemPatch[] }>('/inventory/counts', {
        lines: [{ itemId: item._id, counted: n }],
        note: note.trim() || 'Stock corrected',
      });
      notifyInventoryChanged();
      toast.success(`${item.name} is now ${formatQty(n, item.unit)}`);
      onDone(data.items?.[0] ?? { _id: item._id, onHand: n });
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t correct the stock.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Correct stock"
      description={item.name}
      footer={
        <Button size="lg" block loading={saving} onClick={() => void save()}>
          Save stock level
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[15px] text-cocoa-soft">
          The Studio thinks there’s <strong className="text-cocoa">{formatQty(item.onHand, item.unit)}</strong>. Enter what’s really there — the difference goes into the history as a count.
        </p>
        <Field label={`How many ${item.unit} now?`} htmlFor="correct-qty" error={error}>
          <Input
            id="correct-qty"
            inputMode={isMeasured(item.unit) ? 'decimal' : 'numeric'}
            value={counted}
            invalid={!!error}
            onChange={(e) => {
              setCounted(e.target.value);
              setError('');
            }}
            onFocus={(e) => e.target.select()}
            className="max-w-[200px] text-lg font-semibold tabular"
          />
        </Field>
        <Field label="Reason" htmlFor="correct-note" optional>
          <Input id="correct-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bag split, miscounted delivery" maxLength={200} />
        </Field>
      </div>
    </Overlay>
  );
}
