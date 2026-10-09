import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, History, PackageOpen, Plus, QrCode, ScanLine, SearchX } from 'lucide-react';
import { cachedGet } from '../../lib/cache';
import { onInventoryChanged } from '../../lib/events';
import { formatQty, needsRestock, normalizeCode, stockValue, type InventoryItem, type ItemPatch } from '../../lib/inventory';
import { unlockScanSound } from '../../lib/scanner';
import { cn, formatMoney, plural } from '../../lib/utils';
import { Empty, FilterPills, LoadError, PageTitle, Skeleton } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { buttonClass } from '../../components/ui/buttonStyles';
import { SearchInput } from '../../components/ui/Field';
import { ItemDrawer } from '../../components/inventory/ItemDrawer';
import { ItemEditorDialog } from '../../components/inventory/ItemEditorDialog';
import { ScanSession, type SessionMode } from '../../components/inventory/ScanSession';
import { ScannerTestDialog } from '../../components/inventory/ScannerTestDialog';
import { StockFlag, StockQty } from '../../components/inventory/StockBits';

type Filter = 'all' | 'low' | 'archived';
const isMode = (v: string | null): v is SessionMode => v === 'receive' || v === 'use' || v === 'count';

export function StockPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SessionMode | null>(() => (isMode(params.get('session')) ? (params.get('session') as SessionMode) : null));
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [testing, setTesting] = useState(false);

  // A ?session= link (e.g. from the dashboard) opens once, then leaves the URL clean.
  useEffect(() => {
    if (params.has('session')) setParams({}, { replace: true });
  }, [params, setParams]);

  const load = useCallback(
    (force = false) =>
      cachedGet<{ items: InventoryItem[] }>('/inventory/items', undefined, { force })
        .then((d) => {
          setItems(d.items);
          setError(false);
        })
        .catch(() => setError(true)),
    []
  );

  useEffect(() => {
    void load();
    return onInventoryChanged(() => void load());
  }, [load]);

  const applyPatches = (patches: ItemPatch[]) =>
    setItems((list) => list?.map((i) => {
      const p = patches.find((x) => x._id === i._id);
      return p ? { ...i, ...p } : i;
    }) ?? list);
  const upsert = (item: InventoryItem) => setItems((list) => (list ? (list.some((i) => i._id === item._id) ? list.map((i) => (i._id === item._id ? item : i)) : [...list, item]) : [item]));

  const active = useMemo(() => (items ?? []).filter((i) => i.active), [items]);
  const lowCount = useMemo(() => active.filter(needsRestock).length, [active]);
  const archivedCount = (items?.length ?? 0) - active.length;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const code = normalizeCode(query.trim());
    const list = (items ?? []).filter((i) => {
      if (filter === 'archived' ? i.active : !i.active) return false;
      if (filter === 'low' && !needsRestock(i)) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.barcodes.includes(code);
    });
    const map = new Map<string, InventoryItem[]>();
    for (const i of list) map.set(i.category || 'Other', [...(map.get(i.category || 'Other') ?? []), i]);
    return [...map.entries()]
      .sort((a, b) => (a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : a[0].localeCompare(b[0])))
      .map(([cat, l]) => [cat, l.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [items, filter, query]);

  const start = (m: SessionMode) => {
    unlockScanSound();
    setMode(m);
  };

  const openItem = items?.find((i) => i._id === openId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <PageTitle
        title="Stock"
        description={items ? `${plural(active.length, 'item')} · stock worth ${formatMoney(stockValue(items))}` : 'The store room, counted.'}
        actions={
          <>
            <Link to="/inventory/history" className={buttonClass('outline', 'sm')}>
              <History /> History
            </Link>
            <Link to="/inventory/labels" className={buttonClass('outline', 'sm')}>
              <QrCode /> Labels
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                unlockScanSound();
                setTesting(true);
              }}
            >
              <ScanLine /> Test scanner
            </Button>
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus /> Add item
            </Button>
          </>
        }
      />

      <section aria-label="Scan stock" className="grid gap-3 sm:grid-cols-3">
        <ActionTile icon={<ArrowDownToLine />} title="Receive" body="A delivery came in" onClick={() => start('receive')} className="bg-mint text-white" />
        <ActionTile icon={<ArrowUpFromLine />} title="Use" body="Take stock out" onClick={() => start('use')} className="bg-plum text-cream" />
        <ActionTile icon={<ClipboardCheck />} title="Count" body="Check the shelves" onClick={() => start('count')} className="bg-peach text-plum-900" />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          label="Stock filter"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: items ? active.length : undefined },
            { value: 'low', label: 'Running low', count: items ? lowCount : undefined, countTone: 'honey' },
            { value: 'archived', label: 'Archived', count: items ? archivedCount : undefined },
          ]}
        />
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, category, label or barcode" aria-label="Search stock" className="sm:w-80" />
      </div>

      {error && !items ? (
        <LoadError message="We couldn’t load the stock list." onRetry={() => void load(true)} />
      ) : !items ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="sc-card">
          {items.length === 0 ? (
            <Empty
              icon={<PackageOpen />}
              title="The store room is empty"
              body="Add your first item, or tap Receive and scan a delivery."
              action={
                <Button onClick={() => setEditing('new')}>
                  <Plus /> Add item
                </Button>
              }
            />
          ) : (
            <Empty icon={<SearchX />} title={filter === 'low' && !query ? 'Nothing running low' : 'Nothing matches'} body={filter === 'low' && !query ? 'Every item is above its warn-at level.' : 'Try another word or filter.'} />
          )}
        </div>
      ) : (
        <div className="sc-card overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_130px_minmax(0,1fr)_110px_120px] gap-4 border-b border-crumb bg-cream-deep/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-cocoa-faint md:grid">
            <span>Item</span>
            <span>Label</span>
            <span>Location</span>
            <span>Warn at</span>
            <span className="text-right">On hand</span>
          </div>
          {groups.map(([category, list]) => (
            <section key={category} aria-label={category}>
              <h2 className="border-b border-crumb bg-peach-50/80 px-4 py-2 font-display text-[15px] font-semibold text-peach-700">
                {category} <span className="font-sans text-xs font-medium text-cocoa-faint">· {list.length}</span>
              </h2>
              <ul className="divide-y divide-crumb">
                {list.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(item._id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 text-left transition-colors hover:bg-plum-50 md:grid-cols-[minmax(0,2fr)_130px_minmax(0,1fr)_110px_120px]"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-cocoa">{item.name}</span>
                          <StockFlag item={item} />
                        </span>
                        <span className="block truncate text-xs text-cocoa-faint md:hidden">
                          {[item.location, item.reorderLevel > 0 ? `warn at ${formatQty(item.reorderLevel, item.unit)}` : ''].filter(Boolean).join(' · ') || item.sku}
                        </span>
                      </span>
                      <span className="hidden font-mono text-xs text-cocoa-soft md:block">{item.sku}</span>
                      <span className="hidden truncate text-sm text-cocoa-soft md:block">{item.location || '—'}</span>
                      <span className="hidden text-sm tabular text-cocoa-soft md:block">{item.reorderLevel > 0 ? formatQty(item.reorderLevel, item.unit) : '—'}</span>
                      <StockQty item={item} className="text-right" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ScanSession mode={mode} items={items ?? []} onClose={() => setMode(null)} onSaved={applyPatches} onItemSaved={upsert} />
      <ItemDrawer
        item={editing ? null : openItem}
        onClose={() => setOpenId(null)}
        onEdit={(i) => setEditing(i)}
        onPatched={(p) => applyPatches([p])}
      />
      <ItemEditorDialog
        open={!!editing}
        item={editing === 'new' ? null : editing}
        items={items ?? []}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          upsert(saved);
          setEditing(null);
          setOpenId(saved._id);
        }}
        onDeleted={(id) => {
          setItems((list) => list?.filter((i) => i._id !== id) ?? list);
          setEditing(null);
          setOpenId(null);
        }}
      />
      <ScannerTestDialog open={testing} onOpenChange={setTesting} items={items ?? []} />
    </div>
  );
}

function ActionTile({ icon, title, body, onClick, className }: { icon: ReactNode; title: string; body: string; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group flex min-h-24 items-center gap-4 rounded-xl p-5 text-left shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]', className)}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20 [&_svg]:size-7">{icon}</span>
      <span>
        <span className="block font-display text-2xl font-semibold">{title}</span>
        <span className="block text-sm opacity-85">{body}</span>
      </span>
    </button>
  );
}
