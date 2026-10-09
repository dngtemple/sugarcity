import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import api from '../../lib/api';
import { onInventoryChanged } from '../../lib/events';
import type { MovementType, StockMovement } from '../../lib/inventory';
import { Empty, FilterPills, LoadError, Pager, Skeleton } from '../../components/ui/Bits';
import { MovementLine } from '../../components/inventory/StockBits';

const PAGE_SIZE = 30;
type TypeFilter = 'all' | MovementType;
const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'receive', label: 'Received' },
  { value: 'use', label: 'Used' },
  { value: 'waste', label: 'Wasted' },
  { value: 'count', label: 'Counts' },
  { value: 'adjust', label: 'Adjustments' },
];

export function StockHistoryPage() {
  const [params, setParams] = useSearchParams();
  const type = (TYPES.some((t) => t.value === params.get('type')) ? params.get('type') : 'all') as TypeFilter;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<{ movements: StockMovement[]; total: number } | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<{ movements: StockMovement[]; total: number }>('/inventory/movements', { params: { ...(type !== 'all' ? { type } : {}), page, limit: PAGE_SIZE } })
        .then(({ data: d }) => {
          setData(d);
          setError(false);
        })
        .catch(() => setError(true)),
    [type, page]
  );

  useEffect(() => {
    void load();
    return onInventoryChanged(() => void load());
  }, [load]);

  const go = (next: { type?: TypeFilter; page?: number }) => {
    const p = new URLSearchParams();
    const t = next.type ?? type;
    const pg = next.page ?? page;
    if (t !== 'all') p.set('type', t);
    if (pg > 1) p.set('page', String(pg));
    setParams(p, { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex items-center gap-3">
        <Link to="/inventory" className="inline-flex size-11 items-center justify-center rounded-full bg-card text-plum shadow-soft hover:bg-plum-50" aria-label="Back to stock">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <p className="sc-eyebrow">Stock</p>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-plum">History</h1>
        </div>
      </div>

      <FilterPills label="Movement type" value={type} onChange={(t) => go({ type: t, page: 1 })} items={TYPES} />

      {error && !data ? (
        <LoadError message="We couldn’t load the history." onRetry={() => void load()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : data.movements.length === 0 ? (
        <div className="sc-card">
          <Empty icon={<History />} title="Nothing here yet" body="Deliveries, use, waste and counts are recorded here as they happen." />
        </div>
      ) : (
        <>
          <ul className="sc-card divide-y divide-crumb overflow-hidden">
            {data.movements.map((m) => (
              <MovementLine key={m._id} m={m} />
            ))}
          </ul>
          <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => go({ page: p })} />
        </>
      )}
    </div>
  );
}
