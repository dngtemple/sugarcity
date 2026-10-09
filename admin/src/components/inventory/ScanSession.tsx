import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, CameraOff, History, Link2, Minus, PackagePlus, Plus, X } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { notifyInventoryChanged } from '../../lib/events';
import {
  findByCode,
  formatDelta,
  formatQty,
  isMeasured,
  normalizeCode,
  parseQty,
  trimNumber,
  type InventoryItem,
  type ItemPatch,
} from '../../lib/inventory';
import { useKeyboardScanner } from '../../lib/useKeyboardScanner';
import { cn, formatMoney, plural, readStored, writeStored } from '../../lib/utils';
import { Overlay } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Bits';
import { Confirm } from '../ui/Confirm';
import { Input, SearchInput } from '../ui/Field';
import { CameraScanner, type ScanOutcome } from './CameraScanner';
import { ItemEditorDialog } from './ItemEditorDialog';

export type SessionMode = 'receive' | 'use' | 'count';

interface Line {
  itemId: string;
  /** Kept as typed so "2." or "" survive while editing. */
  qty: string;
  cost: string;
}

interface Draft {
  lines: Line[];
  reason: 'use' | 'waste';
  supplier: string;
  note: string;
}

const EMPTY: Draft = { lines: [], reason: 'use', supplier: '', note: '' };

const COPY: Record<SessionMode, { title: string; save: string; empty: string }> = {
  receive: { title: 'Receive a delivery', save: 'Add to stock', empty: 'Scan each thing in the delivery, then set how many came in.' },
  use: { title: 'Take stock out', save: 'Take out of stock', empty: 'Scan what you’re taking from the store room, then set how much.' },
  count: { title: 'Count the shelves', save: 'Save the count', empty: 'Scan each item and type how many are really there. Only items you scan are changed.' },
};

// The list lives on this device until it's saved, so a refresh or a phone
// call doesn't lose a half-scanned delivery.
const draftKey = (mode: SessionMode) => `sc-admin-stock-draft-${mode}`;
const readDraft = (mode: SessionMode): Draft => ({ ...EMPTY, ...readStored<Partial<Draft>>(draftKey(mode), {}) });
const saveDraft = (mode: SessionMode, d: Draft) =>
  writeStored(draftKey(mode), d.lines.length === 0 && !d.supplier && !d.note ? null : d);

export function ScanSession({
  mode,
  items,
  onClose,
  onSaved,
  onItemSaved,
}: {
  mode: SessionMode | null;
  items: InventoryItem[];
  onClose: () => void;
  onSaved: (patches: ItemPatch[]) => void;
  onItemSaved: (item: InventoryItem) => void;
}) {
  return (
    <Overlay
      open={!!mode}
      onOpenChange={(o) => !o && onClose()}
      kind="full"
      title={mode ? COPY[mode].title : ''}
      description="Your list is kept on this device until you save it"
      bodyClassName="p-0"
    >
      {mode && <SessionBody key={mode} mode={mode} items={items} onClose={onClose} onSaved={onSaved} onItemSaved={onItemSaved} />}
    </Overlay>
  );
}

function SessionBody({
  mode,
  items,
  onClose,
  onSaved,
  onItemSaved,
}: {
  mode: SessionMode;
  items: InventoryItem[];
  onClose: () => void;
  onSaved: (patches: ItemPatch[]) => void;
  onItemSaved: (item: InventoryItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => readDraft(mode));
  const [resumed] = useState(() => draft.lines.length > 0);
  const [cameraOn, setCameraOn] = useState(true);
  const [search, setSearch] = useState('');
  const [unknown, setUnknown] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ barcode?: string } | null>(null);
  const [askClear, setAskClear] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => saveDraft(mode, draft), [mode, draft]);

  const byId = useMemo(() => new Map(items.map((i) => [i._id, i])), [items]);
  const lines = draft.lines.filter((l) => byId.has(l.itemId));
  const counting = mode === 'count';
  const receiving = mode === 'receive';
  const overlayOpen = !!unknown || !!creating || askClear;

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchLine = (itemId: string, p: Partial<Line>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.itemId === itemId ? { ...l, ...p } : l)) }));
  const removeLine = (itemId: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.itemId !== itemId) }));

  /** One more of the item (or the first), moved to the top of the list. */
  const addOne = (item: InventoryItem) => {
    const existing = draft.lines.find((l) => l.itemId === item._id);
    const current = existing ? parseQty(existing.qty) : 0;
    const qty = trimNumber((Number.isNaN(current) ? 0 : current) + 1);
    setDraft((d) => ({ ...d, lines: [{ itemId: item._id, qty, cost: existing?.cost ?? '' }, ...d.lines.filter((l) => l.itemId !== item._id)] }));
    return qty;
  };

  const handleCode = (raw: string): ScanOutcome => {
    const item = findByCode(items, raw);
    if (!item) {
      setUnknown(normalizeCode(raw));
      return { label: `New code ${normalizeCode(raw)}`, tone: 'warning' };
    }
    if (!item.active) return { label: `${item.name} is archived — restore it first`, tone: 'warning' };
    const qty = addOne(item);
    return { label: `${item.name} · ${qty} ${item.unit}`, tone: 'success' };
  };

  // A USB / Bluetooth scanner "types" codes; they land here too.
  useKeyboardScanner((code) => {
    const outcome = handleCode(code);
    if (outcome.tone === 'success') toast.success(outcome.label, { id: 'scan' });
  }, !overlayOpen);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.active && (i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.sku.toLowerCase() === q || i.barcodes.includes(normalizeCode(q))))
      .slice(0, 8);
  }, [items, search]);
  const looksLikeCode = /^\d{6,}$/.test(search.trim()) || /^SC-STK-\d+$/i.test(search.trim());

  const lineError = (line: Line) => {
    const item = byId.get(line.itemId)!;
    const n = parseQty(line.qty);
    if (Number.isNaN(n) || n < 0 || (!counting && n === 0)) return counting ? 'How many are there? (0 or more)' : 'Enter a quantity above 0.';
    if (mode === 'use' && n > item.onHand + 1e-9) return `Only ${formatQty(Math.max(item.onHand, 0), item.unit)} in stock. Count the shelf if that’s wrong.`;
    if (receiving && line.cost.trim() && (Number.isNaN(parseQty(line.cost)) || parseQty(line.cost) < 0)) return 'That cost doesn’t look right — fix it or leave it empty.';
    return null;
  };

  const deliveryTotal = receiving
    ? lines.reduce((s, l) => {
        const q = parseQty(l.qty);
        const c = parseQty(l.cost);
        return Number.isNaN(q) || Number.isNaN(c) ? s : s + q * c;
      }, 0)
    : 0;

  const save = async () => {
    if (lines.length === 0) return;
    if (lines.some(lineError)) {
      setShowErrors(true);
      toast.error('Some lines need a look first.');
      return;
    }
    setSaving(true);
    try {
      if (counting) {
        const { data } = await api.post<{ reference: string; changed: number; items: ItemPatch[] }>('/inventory/counts', {
          lines: lines.map((l) => ({ itemId: l.itemId, counted: parseQty(l.qty) })),
          note: draft.note.trim(),
        });
        onSaved(data.items);
        toast.success(`Count ${data.reference} saved · ${data.changed === 0 ? 'everything matched' : `${plural(data.changed, 'item')} corrected`}`);
      } else {
        const { data } = await api.post<{ reference?: string; items: ItemPatch[] }>('/inventory/movements', {
          type: receiving ? 'receive' : draft.reason,
          lines: lines.map((l) => ({ itemId: l.itemId, quantity: parseQty(l.qty), ...(receiving && l.cost.trim() ? { unitCost: parseQty(l.cost) } : {}) })),
          supplier: draft.supplier.trim(),
          note: draft.note.trim(),
        });
        onSaved(data.items);
        toast.success(receiving ? `Delivery ${data.reference ?? ''} added to stock` : `${plural(lines.length, 'item')} taken out of stock`);
      }
      notifyInventoryChanged();
      // Cleared here: closing unmounts this before the draft effect would run.
      saveDraft(mode, EMPTY);
      setDraft(EMPTY);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save. Your list is kept — try again.'));
    } finally {
      setSaving(false);
    }
  };

  const attachCode = async (item: InventoryItem, code: string) => {
    try {
      const { data } = await api.put<InventoryItem>(`/inventory/items/${item._id}`, { barcodes: [...item.barcodes, code] });
      notifyInventoryChanged();
      onItemSaved(data);
      addOne(data);
      setUnknown(null);
      toast.success(`Code saved on ${data.name}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save the code.'));
    }
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      {/* Scanner */}
      <div className="shrink-0 bg-plum-900 lg:w-1/2">
        {cameraOn ? (
          <CameraScanner className="h-[36dvh] max-h-96 min-h-56 lg:h-full lg:max-h-none" onScan={handleCode} paused={overlayOpen} />
        ) : (
          <div className="flex h-24 items-center justify-center text-sm text-cream/70 lg:h-full">Camera off — scan with a handheld scanner or search below.</div>
        )}
        <div className="flex justify-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            aria-pressed={cameraOn}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-cream/80 hover:bg-white/10"
          >
            {cameraOn ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
            {cameraOn ? 'Turn camera off' : 'Turn camera on'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {resumed && lines.length > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-700">
              <History className="size-4 shrink-0" aria-hidden /> Picking up where you left off.
            </p>
          )}

          <div>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !search.trim()) return;
                e.preventDefault();
                if (findByCode(items, search.trim()) || looksLikeCode) {
                  handleCode(search.trim());
                  setSearch('');
                } else if (results.length === 1) {
                  addOne(results[0]);
                  setSearch('');
                }
              }}
              placeholder="Search by name, or type a code"
              aria-label="Find an item"
            />
            {search.trim() && (
              <div className="mt-1.5 overflow-hidden rounded-lg border border-crumb bg-card shadow-soft">
                {results.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => {
                      addOne(item);
                      setSearch('');
                    }}
                    className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-crumb px-4 text-left last:border-0 hover:bg-plum-50"
                  >
                    <span className="truncate font-medium text-cocoa">{item.name}</span>
                    <span className="shrink-0 text-sm tabular text-cocoa-faint">{formatQty(item.onHand, item.unit)}</span>
                  </button>
                ))}
                {results.length === 0 && (
                  <div className="px-4 py-3 text-sm text-cocoa-soft">
                    {looksLikeCode ? (
                      <button type="button" className="sc-link" onClick={() => { handleCode(search.trim()); setSearch(''); }}>
                        Use code {search.trim()}
                      </button>
                    ) : (
                      <>
                        Nothing matches.{' '}
                        <button type="button" className="sc-link" onClick={() => setCreating({})}>
                          Add a new item
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {receiving && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={draft.supplier} onChange={(e) => patch({ supplier: e.target.value })} placeholder="Supplier (optional)" aria-label="Supplier" maxLength={80} />
              <Input value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder="Invoice no. or note" aria-label="Invoice number or note" maxLength={200} />
            </div>
          )}
          {mode === 'use' && (
            <div className="space-y-2">
              <Segmented
                label="Why is it leaving the store?"
                value={draft.reason}
                onChange={(reason) => patch({ reason })}
                className="flex w-full"
                items={[
                  { value: 'use', label: 'Used' },
                  { value: 'waste', label: 'Wasted' },
                ]}
              />
              <Input value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder={draft.reason === 'waste' ? 'What happened? e.g. Expired' : 'Note, e.g. For order SC-1042'} aria-label="Note" maxLength={200} />
            </div>
          )}
          {counting && <Input value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder="Note, e.g. Month-end count" aria-label="Note" maxLength={200} />}

          {lines.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-crumb-strong px-6 py-10 text-center text-[15px] text-cocoa-soft">{COPY[mode].empty}</p>
          ) : (
            <ul className="divide-y divide-crumb rounded-xl border border-crumb bg-card">
              {lines.map((line) => {
                const item = byId.get(line.itemId)!;
                const error = showErrors ? lineError(line) : null;
                const n = parseQty(line.qty);
                const lineCost = receiving ? parseQty(line.cost) * n : NaN;
                return (
                  <li key={line.itemId} className={cn('space-y-2 px-4 py-3', error && 'bg-berry-50/70')}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-cocoa">{item.name}</p>
                        <p className="text-sm text-cocoa-soft">
                          {counting ? 'Studio says ' : 'In stock: '}
                          {formatQty(item.onHand, item.unit)}
                          {counting && !Number.isNaN(n) && (
                            <span className={cn('ml-1.5 font-semibold', n - item.onHand === 0 ? 'text-mint-700' : 'text-honey-700')}>
                              {n - item.onHand === 0 ? '· matches' : `· ${formatDelta(Math.round((n - item.onHand) * 1000) / 1000, item.unit)}`}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.itemId)}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-cocoa-faint hover:bg-berry-50 hover:text-berry"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <QtyField
                        value={line.qty}
                        unit={item.unit}
                        label={counting ? `Counted ${item.name}` : `Quantity of ${item.name}`}
                        min={counting ? 0 : 1}
                        invalid={!!error}
                        onChange={(qty) => patchLine(line.itemId, { qty })}
                      />
                      {receiving && (
                        <label className="flex items-center gap-2 text-sm text-cocoa-faint">
                          <Input
                            value={line.cost}
                            inputMode="decimal"
                            onChange={(e) => patchLine(line.itemId, { cost: e.target.value })}
                            placeholder={item.avgCost > 0 ? String(item.avgCost) : '0.00'}
                            aria-label={`Unit cost for ${item.name}, GH₵ per ${item.unit}`}
                            className="w-24"
                          />
                          GH₵ / {item.unit}
                        </label>
                      )}
                    </div>
                    {receiving && !Number.isNaN(lineCost) && lineCost > 0 && <p className="text-sm tabular text-cocoa-soft">Line total {formatMoney(lineCost)}</p>}
                    {error && (
                      <p className="text-sm font-medium text-berry" role="alert">
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {lines.length > 0 && (
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setAskClear(true)}>
                Clear list
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCreating({})}>
                <PackagePlus /> New item
              </Button>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-crumb bg-card px-4 pt-3 pb-safe sm:px-5">
          {receiving && deliveryTotal > 0 && (
            <p className="mb-2 flex justify-between text-sm text-cocoa-soft">
              Delivery total <span className="font-semibold tabular text-cocoa">{formatMoney(deliveryTotal)}</span>
            </p>
          )}
          <Button size="lg" block loading={saving} disabled={lines.length === 0} onClick={() => void save()}>
            {COPY[mode].save}
            {lines.length > 0 && ` · ${plural(lines.length, 'item')}`}
          </Button>
        </div>
      </div>

      <UnknownCodeDialog
        code={unknown}
        items={items}
        onClose={() => setUnknown(null)}
        onCreate={() => {
          setCreating({ barcode: unknown ?? undefined });
          setUnknown(null);
        }}
        onAttach={attachCode}
      />
      <ItemEditorDialog
        open={!!creating}
        item={null}
        items={items}
        initialBarcode={creating?.barcode}
        withOpeningStock={false}
        onClose={() => setCreating(null)}
        onSaved={(saved) => {
          onItemSaved(saved);
          addOne(saved);
          setCreating(null);
        }}
      />
      <Confirm
        open={askClear}
        onOpenChange={setAskClear}
        title="Clear the whole list?"
        body="Every scanned line goes. Nothing has been saved to stock yet."
        confirmLabel="Clear list"
        cancelLabel="Keep it"
        onConfirm={() => {
          setDraft(EMPTY);
          setAskClear(false);
        }}
      />
    </div>
  );
}

/** − typed + around a quantity. Counted units step by 1; weighed ones accept decimals. */
function QtyField({ value, unit, label, min, invalid, onChange }: { value: string; unit: string; label: string; min: number; invalid?: boolean; onChange: (v: string) => void }) {
  const n = parseQty(value);
  const step = (d: number) => onChange(trimNumber(Math.max(min, (Number.isNaN(n) ? 0 : n) + d)));
  const btn = 'inline-flex size-11 items-center justify-center rounded-full bg-plum-50 text-plum hover:bg-plum-100 active:scale-95 disabled:opacity-35';
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => step(-1)} disabled={!Number.isNaN(n) && n - 1 < min} aria-label={`Less — ${label}`}>
        <Minus className="size-5" />
      </button>
      <Input
        value={value}
        inputMode={isMeasured(unit) ? 'decimal' : 'numeric'}
        invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className="w-20 text-center font-semibold tabular"
      />
      <button type="button" className={btn} onClick={() => step(1)} aria-label={`More — ${label}`}>
        <Plus className="size-5" />
      </button>
      <span className="text-sm text-cocoa-faint">{unit}</span>
    </div>
  );
}

/** A code no item has yet: make a new item, or add the code to one you already stock. */
function UnknownCodeDialog({
  code,
  items,
  onClose,
  onCreate,
  onAttach,
}: {
  code: string | null;
  items: InventoryItem[];
  onClose: () => void;
  onCreate: () => void;
  onAttach: (item: InventoryItem, code: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => i.active && (!q || i.name.toLowerCase().includes(q))).slice(0, 30);
  }, [items, query]);

  const close = () => {
    setPicking(false);
    setQuery('');
    onClose();
  };

  return (
    <Overlay
      open={!!code}
      onOpenChange={(o) => !o && close()}
      title={picking ? 'Which item is it?' : 'A code we don’t know'}
      description={picking ? `Code ${code} will be saved on it` : undefined}
      onBack={picking ? () => setPicking(false) : undefined}
      footer={
        picking ? undefined : (
          <div className="space-y-2">
            <Button size="lg" block onClick={onCreate}>
              <PackagePlus /> Create a new item
            </Button>
            <Button variant="soft" size="lg" block onClick={() => setPicking(true)} disabled={items.length === 0}>
              <Link2 /> Attach to an existing item
            </Button>
            <Button variant="ghost" block onClick={close}>
              Ignore this scan
            </Button>
          </div>
        )
      }
    >
      {picking ? (
        <div className="space-y-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" aria-label="Search items" autoFocus />
          <ul className="divide-y divide-crumb rounded-lg border border-crumb bg-card">
            {matches.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  disabled={!!saving}
                  onClick={async () => {
                    if (!code) return;
                    setSaving(item._id);
                    await onAttach(item, code);
                    setSaving(null);
                    setPicking(false);
                    setQuery('');
                  }}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left hover:bg-plum-50 disabled:opacity-60"
                >
                  <span className="truncate font-medium text-cocoa">{item.name}</span>
                  <span className="shrink-0 text-sm text-cocoa-faint">{saving === item._id ? 'Saving…' : formatQty(item.onHand, item.unit)}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-4 py-3 text-sm text-cocoa-soft">No items match.</li>}
          </ul>
        </div>
      ) : (
        <div className="space-y-2 text-[15px] text-cocoa-soft">
          <p>
            Nothing in the store room has the code <span className="rounded bg-plum-50 px-1.5 py-0.5 font-mono font-semibold text-plum">{code}</span> yet.
          </p>
          <p>Is it something new, or a new brand of something you already keep?</p>
        </div>
      )}
    </Overlay>
  );
}
