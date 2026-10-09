import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info, Printer } from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { cachedGet } from '../../lib/cache';
import type { InventoryItem } from '../../lib/inventory';
import { A4, LABEL_SHEETS, MM_TO_PX, paginateLabels, qrPath, slotPosition, type LabelSheet } from '../../lib/labels';
import { plural } from '../../lib/utils';
import { Card, Skeleton, Stepper } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Field, Input, SearchInput, Select } from '../../components/ui/Field';

function Sticker({ item, sheet }: { item: InventoryItem; sheet: LabelSheet }) {
  const qr = useMemo(() => qrPath(item.sku), [item.sku]);
  const pad = 2.5;
  const size = sheet.h - pad * 2;
  return (
    <div className="flex items-center overflow-hidden text-black" style={{ width: `${sheet.w}mm`, height: `${sheet.h}mm`, padding: `${pad}mm`, gap: '2mm' }}>
      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} style={{ width: `${size}mm`, height: `${size}mm`, flexShrink: 0 }} shapeRendering="crispEdges" aria-hidden>
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.d} fill="#000" />
      </svg>
      <div className="min-w-0">
        <p className="line-clamp-3 font-semibold leading-tight" style={{ fontSize: sheet.h < 32 ? '8pt' : '10pt' }}>
          {item.name}
        </p>
        <p className="font-mono" style={{ fontSize: '7pt', marginTop: '1mm' }}>
          {item.sku}
        </p>
      </div>
    </div>
  );
}

/**
 * Printable QR labels for things with no barcode — tubs of icing, repacked
 * sugar, shelves. Each QR holds the item's SKU, which the scanner looks up.
 */
export function LabelsPage() {
  const [params] = useSearchParams();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copies, setCopies] = useState<Record<string, number>>(() =>
    Object.fromEntries((params.get('ids') ?? '').split(',').filter(Boolean).map((id) => [id, 1]))
  );
  const [sheetId, setSheetId] = useState(LABEL_SHEETS[1].id);
  const [skip, setSkip] = useState('0');
  const [query, setQuery] = useState('');
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Print labels · Sugar City Studio';
    cachedGet<{ items: InventoryItem[] }>('/inventory/items')
      .then((d) => setItems(d.items.filter((i) => i.active)))
      .catch((err) => setError(errorMessage(err, 'We couldn’t load the stock items.')));
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setPreviewWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sheet = LABEL_SHEETS.find((s) => s.id === sheetId)!;
  const entries = useMemo(() => (items ?? []).flatMap((i) => Array.from({ length: copies[i._id] ?? 0 }, () => i)), [items, copies]);
  const { pages, perPage } = paginateLabels(entries, sheet, Number(skip));
  const total = entries.length;
  const scale = previewWidth ? Math.min(1, previewWidth / (A4.w * MM_TO_PX)) : 0.4;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => !q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="min-h-dvh bg-cream">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .sheet-frame { width: auto !important; height: auto !important; box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
          .sheet-page { transform: none !important; }
          .sheet-frame + .sheet-frame { break-before: page; }
          .sheet-slot { outline: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <Link to="/inventory" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-plum hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to stock
        </Link>
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-tight text-plum">Print QR labels</h1>
          <p className="mt-1 text-[15px] text-cocoa-soft">Stick one on a tub, bag or shelf. Scanning the label finds the item, just like a barcode.</p>
        </div>

        {error ? (
          <Card className="p-6 text-center font-semibold text-cocoa">{error}</Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-cocoa">How many of each</h2>
                {items && items.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCopies(Object.fromEntries(items.map((i) => [i._id, Math.max(copies[i._id] ?? 0, 1)])))}>
                    One of everything
                  </Button>
                )}
              </div>
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" aria-label="Search items" />
              {!items ? (
                <Skeleton className="h-48" />
              ) : items.length === 0 ? (
                <p className="text-sm text-cocoa-soft">Add stock items first.</p>
              ) : (
                <ul className="max-h-[440px] divide-y divide-crumb overflow-y-auto rounded-lg border border-crumb">
                  {shown.map((item) => (
                    <li key={item._id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-cocoa">{item.name}</p>
                        <p className="font-mono text-xs text-cocoa-faint">{item.sku}</p>
                      </div>
                      <Stepper value={copies[item._id] ?? 0} min={0} max={perPage * 4} onChange={(n) => setCopies((c) => ({ ...c, [item._id]: n }))} label={`labels for ${item.name}`} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="h-fit space-y-4 p-4 sm:p-5">
              <Field label="Sticker sheet" htmlFor="label-sheet" hint={sheet.hint}>
                <Select id="label-sheet" value={sheetId} onChange={setSheetId} options={LABEL_SHEETS.map((s) => ({ value: s.id, label: `A4 · ${s.label}` }))} />
              </Field>
              <Field label="Skip stickers already used" htmlFor="label-skip" hint="For a part-used sheet: how many spots at the top are gone.">
                <Input id="label-skip" inputMode="numeric" value={skip} onChange={(e) => setSkip(e.target.value.replace(/\D/g, ''))} className="max-w-[120px]" />
              </Field>
              <Button size="lg" block disabled={total === 0} onClick={() => window.print()}>
                <Printer /> {total > 0 ? `Print ${plural(total, 'label')}` : 'Print labels'}
              </Button>
              <p className="flex gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-700">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                In the print window choose A4 and print at 100% scale (not “fit to page”) so labels line up with the stickers.
              </p>
            </Card>
          </div>
        )}
      </div>

      <div className="print-area mx-auto max-w-5xl space-y-4 px-4 pb-12 sm:px-6">
        <div ref={previewRef} className="no-print" />
        {total === 0 ? (
          <p className="no-print text-center text-sm text-cocoa-faint">Choose how many labels you need to see a preview.</p>
        ) : (
          pages.map((page, p) => (
            <div key={p} className="sheet-frame mx-auto overflow-hidden rounded-sm bg-white shadow-soft" style={{ width: A4.w * MM_TO_PX * scale, height: A4.h * MM_TO_PX * scale }}>
              <div className="sheet-page relative origin-top-left" style={{ width: `${A4.w}mm`, height: `${A4.h}mm`, transform: `scale(${scale})` }}>
                {page.map((item, i) => {
                  const pos = slotPosition(sheet, i);
                  return (
                    <div
                      key={i}
                      className="sheet-slot absolute outline-dashed outline-1 outline-crumb-strong"
                      style={{ left: `${pos.left}mm`, top: `${pos.top}mm`, width: `${sheet.w}mm`, height: `${sheet.h}mm` }}
                    >
                      {item && <Sticker item={item} sheet={sheet} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
