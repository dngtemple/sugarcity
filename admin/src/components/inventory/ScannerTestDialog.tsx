import { useState } from 'react';
import { findByCode, formatQty, normalizeCode, type InventoryItem } from '../../lib/inventory';
import { useKeyboardScanner } from '../../lib/useKeyboardScanner';
import { Overlay } from '../ui/Overlay';
import { CameraScanner, type ScanOutcome } from './CameraScanner';

interface Read {
  code: string;
  item: InventoryItem | undefined;
  via: 'camera' | 'scanner';
  at: number;
}

/** Point the camera (or a handheld scanner) at anything and see what we read. Saves nothing. */
export function ScannerTestDialog({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: InventoryItem[] }) {
  return (
    <Overlay open={open} onOpenChange={onOpenChange} title="Test the scanner" description="Nothing is saved here" bodyClassName="p-0">
      {open && <TestBody items={items} />}
    </Overlay>
  );
}

function TestBody({ items }: { items: InventoryItem[] }) {
  const [reads, setReads] = useState<Read[]>([]);

  const record = (raw: string, via: Read['via']): ScanOutcome => {
    const code = normalizeCode(raw);
    const item = findByCode(items, code);
    setReads((r) => [{ code, item, via, at: Date.now() }, ...r].slice(0, 8));
    return item ? { label: `${item.name} · ${formatQty(item.onHand, item.unit)}`, tone: 'success' } : { label: `Read ${code} — no item has it`, tone: 'warning' };
  };

  useKeyboardScanner((code) => void record(code, 'scanner'));

  return (
    <div>
      <CameraScanner className="h-72" onScan={(code) => record(code, 'camera')} />
      <div className="space-y-2 px-4 py-4 sm:px-5">
        <p className="text-sm text-cocoa-soft">Handheld USB or Bluetooth scanners work too — just scan while this is open.</p>
        {reads.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-crumb-strong px-4 py-6 text-center text-sm text-cocoa-faint">Nothing read yet.</p>
        ) : (
          <ul className="divide-y divide-crumb rounded-lg border border-crumb bg-card">
            {reads.map((r) => (
              <li key={r.at} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-semibold text-cocoa">{r.code}</span>
                  <span className="block text-xs text-cocoa-faint">via {r.via}</span>
                </span>
                <span className={r.item ? 'text-sm font-semibold text-mint-700' : 'text-sm text-honey-700'}>{r.item ? r.item.name : 'Unknown code'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
