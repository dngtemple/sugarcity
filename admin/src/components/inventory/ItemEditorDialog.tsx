import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, Keyboard, Plus, ScanLine, Trash2, X } from 'lucide-react';
import api, { errorMessage } from '../../lib/api';
import { notifyInventoryChanged } from '../../lib/events';
import { UNITS, UNIT_LABELS, findByCode, isMeasured, normalizeCode, parseQty, type InventoryItem, type Unit } from '../../lib/inventory';
import { unlockScanSound } from '../../lib/scanner';
import { Overlay } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Confirm } from '../ui/Confirm';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { CameraScanner } from './CameraScanner';

const NEW_CATEGORY = '__new__';
const MAX_BARCODES = 10;

interface Draft {
  name: string;
  category: string;
  newCategory: string;
  unit: Unit;
  reorderLevel: string;
  openingStock: string;
  unitCost: string;
  location: string;
  supplier: string;
  barcodes: string[];
  notes: string;
}

type Errors = Partial<Record<'name' | 'category' | 'reorderLevel' | 'openingStock' | 'unitCost' | 'barcode', string>>;

/**
 * Add or edit a stock item. A new item can start from a scanned code
 * (`initialBarcode`); opening stock is only offered outside a scan session,
 * where the session itself adds the quantity.
 */
export function ItemEditorDialog({
  open,
  item,
  items,
  initialBarcode,
  withOpeningStock = true,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  item: InventoryItem | null;
  items: InventoryItem[];
  initialBarcode?: string;
  withOpeningStock?: boolean;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (id: string) => void;
}) {
  return open ? (
    <EditorBody
      key={item?._id ?? `new-${initialBarcode ?? ''}`}
      item={item}
      items={items}
      initialBarcode={initialBarcode}
      withOpeningStock={withOpeningStock}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  ) : null;
}

function EditorBody({
  item,
  items,
  initialBarcode,
  withOpeningStock,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: InventoryItem | null;
  items: InventoryItem[];
  initialBarcode?: string;
  withOpeningStock: boolean;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  onDeleted?: (id: string) => void;
}) {
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const [initial] = useState<Draft>(() => ({
    name: item?.name ?? '',
    category: item ? item.category : categories.length ? '' : NEW_CATEGORY,
    newCategory: '',
    unit: item?.unit ?? 'pcs',
    reorderLevel: item?.reorderLevel ? String(item.reorderLevel) : '',
    openingStock: '',
    unitCost: '',
    location: item?.location ?? '',
    supplier: item?.supplier ?? '',
    barcodes: item?.barcodes ?? (initialBarcode ? [normalizeCode(initialBarcode)] : []),
    notes: item?.notes ?? '',
  }));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [typed, setTyped] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null);
  const [askDiscard, setAskDiscard] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addCode = (raw: string): string | null => {
    const code = normalizeCode(raw);
    if (!code) return 'Type or scan a code first.';
    if (draft.barcodes.includes(code)) return 'That code is already on this item.';
    if (draft.barcodes.length >= MAX_BARCODES) return `An item can have up to ${MAX_BARCODES} codes.`;
    const other = findByCode(items, code);
    if (other && other._id !== item?._id) return `That code belongs to “${other.name}”.`;
    setDraft((d) => ({ ...d, barcodes: [...d.barcodes, code] }));
    setErrors((e) => ({ ...e, barcode: undefined }));
    return null;
  };

  const save = async () => {
    const e: Errors = {};
    if (!draft.name.trim()) e.name = 'What is it called?';
    if (draft.category === NEW_CATEGORY && !draft.newCategory.trim()) e.category = 'Type the new category, or pick one.';
    const reorder = parseQty(draft.reorderLevel);
    if (draft.reorderLevel.trim() && (Number.isNaN(reorder) || reorder < 0)) e.reorderLevel = 'A number, or leave it empty.';
    if (!item && withOpeningStock) {
      const opening = parseQty(draft.openingStock);
      if (draft.openingStock.trim() && (Number.isNaN(opening) || opening < 0)) e.openingStock = 'A number, or leave it empty.';
      const cost = parseQty(draft.unitCost);
      if (draft.unitCost.trim() && (Number.isNaN(cost) || cost < 0)) e.unitCost = 'A price, or leave it empty.';
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      category: draft.category === NEW_CATEGORY ? draft.newCategory.trim() : draft.category,
      unit: draft.unit,
      reorderLevel: draft.reorderLevel.trim() ? parseQty(draft.reorderLevel) : 0,
      location: draft.location.trim(),
      supplier: draft.supplier.trim(),
      notes: draft.notes.trim(),
      barcodes: draft.barcodes,
    };
    if (!item && withOpeningStock) {
      if (draft.openingStock.trim()) body.openingStock = parseQty(draft.openingStock);
      if (draft.unitCost.trim()) body.unitCost = parseQty(draft.unitCost);
    }
    setSaving(true);
    try {
      const { data } = item ? await api.put<InventoryItem>(`/inventory/items/${item._id}`, body) : await api.post<InventoryItem>('/inventory/items', body);
      notifyInventoryChanged();
      toast.success(item ? `${data.name} saved` : `${data.name} added · label ${data.sku}`);
      onSaved(data);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save the item. Please try again.'));
      setSaving(false);
    }
  };

  const setActive = async (active: boolean) => {
    if (!item) return;
    setBusy('archive');
    try {
      const { data } = await api.put<InventoryItem>(`/inventory/items/${item._id}`, { active });
      notifyInventoryChanged();
      toast.success(active ? `${item.name} is back on the list` : `${item.name} archived`);
      onSaved(data);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t update the item.'));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!item) return;
    setBusy('delete');
    try {
      await api.delete(`/inventory/items/${item._id}`);
      notifyInventoryChanged();
      toast.success(`${item.name} deleted`);
      onDeleted?.(item._id);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t delete it. Items with history can only be archived.'));
      setAskDelete(false);
      setBusy(null);
    }
  };

  const tryClose = () => (dirty ? setAskDiscard(true) : onClose());

  return (
    <Overlay
      open
      onOpenChange={(o) => !o && tryClose()}
      width="sm:w-[min(600px,calc(100vw-32px))]"
      title={item ? `Edit ${item.name}` : 'New stock item'}
      description={item ? `Label code ${item.sku}` : 'Something you keep in the store room'}
      guard={() => {
        if (dirty) setAskDiscard(true);
        return dirty;
      }}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={tryClose}>
            Cancel
          </Button>
          <Button size="lg" className="flex-[2]" loading={saving} onClick={() => void save()}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Name" htmlFor="inv-name" error={errors.name}>
          <Input id="inv-name" value={draft.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Cake flour, 25 kg bag" maxLength={80} autoFocus={!item} />
        </Field>
        <div>
          <Field label="Category" htmlFor="inv-cat" optional error={errors.category}>
            <Select
              id="inv-cat"
              value={draft.category}
              placeholder="Pick a category"
              invalid={!!errors.category}
              onChange={(v) => set('category', v)}
              options={[...categories.map((c) => ({ value: c, label: c })), { value: NEW_CATEGORY, label: '+ New category…' }]}
            />
          </Field>
          {draft.category === NEW_CATEGORY && (
            <Input className="mt-2" value={draft.newCategory} onChange={(e) => set('newCategory', e.target.value)} placeholder="e.g. Baking, Dairy, Boxes & ribbon" aria-label="New category" maxLength={60} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit" htmlFor="inv-unit">
            <Select id="inv-unit" value={draft.unit} onChange={(v) => set('unit', v)} options={UNITS.map((u) => ({ value: u, label: `${u} — ${UNIT_LABELS[u]}` }))} />
          </Field>
          <Field label="Warn at" htmlFor="inv-warn" optional error={errors.reorderLevel} hint={errors.reorderLevel ? undefined : `“Running low” at ${draft.unit}.`}>
            <Input id="inv-warn" inputMode="decimal" value={draft.reorderLevel} invalid={!!errors.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value)} placeholder="e.g. 5" />
          </Field>
        </div>
        {!item && withOpeningStock && (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-peach-50 p-3">
            <Field label="Opening stock" htmlFor="inv-open" optional error={errors.openingStock} hint={`In ${draft.unit}`}>
              <Input id="inv-open" inputMode={isMeasured(draft.unit) ? 'decimal' : 'numeric'} value={draft.openingStock} invalid={!!errors.openingStock} onChange={(e) => set('openingStock', e.target.value)} placeholder="0" />
            </Field>
            <Field label={`Cost per ${draft.unit}`} htmlFor="inv-cost" optional error={errors.unitCost} hint="GH₵">
              <Input id="inv-cost" inputMode="decimal" value={draft.unitCost} invalid={!!errors.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location" htmlFor="inv-loc" optional>
            <Input id="inv-loc" value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Cold room" maxLength={60} />
          </Field>
          <Field label="Supplier" htmlFor="inv-sup" optional>
            <Input id="inv-sup" value={draft.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="e.g. Makola wholesale" maxLength={80} />
          </Field>
        </div>

        <section className="rounded-lg border border-crumb bg-card p-4">
          <h3 className="font-display text-base font-semibold text-cocoa">
            Barcodes <span className="font-sans text-xs font-medium text-cocoa-faint">{draft.barcodes.length}/{MAX_BARCODES}</span>
          </h3>
          <p className="mt-0.5 text-sm text-cocoa-soft">
            Scan the pack’s barcode so scanning finds this item — one per brand. No barcode? Print a QR label{item ? ` (code ${item.sku})` : ' once it’s saved'}.
          </p>
          {draft.barcodes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {draft.barcodes.map((code) => (
                <li key={code} className="flex items-center gap-1 rounded-full bg-plum-50 py-0.5 pl-3 pr-0.5 font-mono text-sm text-plum">
                  {code}
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, barcodes: d.barcodes.filter((c) => c !== code) }))}
                    className="inline-flex size-9 items-center justify-center rounded-full hover:bg-berry-50 hover:text-berry"
                    aria-label={`Remove code ${code}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {scanning ? (
            <div className="mt-3">
              <CameraScanner
                className="h-56 rounded-lg"
                onScan={(code) => {
                  const problem = addCode(code);
                  if (problem) return { label: problem, tone: 'warning' };
                  setScanning(false);
                  toast.success(`Code ${normalizeCode(code)} added`);
                  return { label: 'Added', tone: 'success' };
                }}
              />
              <Button variant="outline" size="sm" block className="mt-2" onClick={() => setScanning(false)}>
                Stop scanning
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Button
                variant="soft"
                size="sm"
                disabled={draft.barcodes.length >= MAX_BARCODES}
                onClick={() => {
                  unlockScanSound();
                  setScanning(true);
                }}
              >
                <ScanLine /> Scan a code
              </Button>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-cocoa-faint" aria-hidden />
                  <Input
                    value={typed}
                    inputMode="numeric"
                    invalid={!!errors.barcode}
                    onChange={(e) => {
                      setTyped(e.target.value);
                      setErrors((x) => ({ ...x, barcode: undefined }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const problem = addCode(typed);
                      if (problem) setErrors((x) => ({ ...x, barcode: problem }));
                      else setTyped('');
                    }}
                    placeholder="Or type the numbers"
                    aria-label="Type a barcode"
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const problem = addCode(typed);
                    if (problem) setErrors((x) => ({ ...x, barcode: problem }));
                    else setTyped('');
                  }}
                >
                  <Plus /> Add
                </Button>
              </div>
              {errors.barcode && (
                <p className="text-sm font-medium text-berry" role="alert">
                  {errors.barcode}
                </p>
              )}
            </div>
          )}
        </section>

        <Field label="Notes" htmlFor="inv-notes" optional>
          <Textarea id="inv-notes" value={draft.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} className="min-h-20" placeholder="e.g. Buy the 25 kg bag — cheaper per kilo." />
        </Field>

        {item && (
          <section className="space-y-3 rounded-lg border border-crumb p-4">
            {item.active ? (
              <>
                <p className="text-sm text-cocoa-soft">Not buying this any more? Archive it — the history stays, and you can bring it back.</p>
                <Button variant="outline" size="sm" loading={busy === 'archive'} onClick={() => void setActive(false)}>
                  <Archive /> Archive
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-cocoa-soft">This item is archived. Restore it to track its stock again.</p>
                <Button variant="soft" size="sm" loading={busy === 'archive'} onClick={() => void setActive(true)}>
                  <ArchiveRestore /> Restore
                </Button>
              </>
            )}
            {onDeleted && (
              <div className="border-t border-crumb pt-3">
                <p className="text-sm text-cocoa-soft">Added by mistake? Items with no stock history can be deleted.</p>
                <Button variant="ghost" size="sm" className="mt-1 text-berry hover:bg-berry-50 hover:text-berry" onClick={() => setAskDelete(true)}>
                  <Trash2 /> Delete item
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <Confirm
        open={askDiscard}
        onOpenChange={setAskDiscard}
        title="Throw away your changes?"
        body="What you typed for this item hasn’t been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setAskDiscard(false);
          onClose();
        }}
      />
      <Confirm
        open={askDelete}
        onOpenChange={setAskDelete}
        title={`Delete ${item?.name ?? 'this item'}?`}
        body="It’s removed for good. If it already has stock history, archive it instead."
        confirmLabel="Delete item"
        loading={busy === 'delete'}
        onConfirm={() => void remove()}
      />
    </Overlay>
  );
}
