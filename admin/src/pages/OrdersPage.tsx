import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Columns3, List, Plus, SearchX } from 'lucide-react';
import api from '../lib/api';
import { onOrdersChanged } from '../lib/events';
import { useDebounced, useIsDesktop, useVisiblePoll } from '../lib/hooks';
import { useOrderSummary } from '../lib/useCounts';
import { STATUSES, customerName, isStatus, itemCount, type OrderPage as OrderPageData, type OrderStatus } from '../lib/orders';
import { formatMoney, plural, readStored, writeStored } from '../lib/utils';
import { Empty, FilterPills, LoadError, PageTitle, Pager, Segmented, Skeleton } from '../components/ui/Bits';
import { SearchInput } from '../components/ui/Field';
import { buttonClass } from '../components/ui/buttonStyles';
import { DueTag, PaymentPill, StatusPill, TypeIcon } from '../components/orders/OrderBits';
import { OrderBoard } from '../components/orders/OrderBoard';

type View = 'board' | 'list';
const VIEW_KEY = 'sc-admin-orders-view';

export function OrdersPage() {
  const [params] = useSearchParams();
  const legacy = params.get('order');
  const isDesktop = useIsDesktop();
  const [savedView, setSavedView] = useState<View | null>(() => readStored<View | null>(VIEW_KEY, null));
  const view: View = savedView ?? (isDesktop ? 'board' : 'list');

  // Old links (e-mails) point at /orders?order=<id>.
  if (legacy) return <Navigate to={`/orders/${encodeURIComponent(legacy)}`} replace />;

  const chooseView = (v: View) => {
    setSavedView(v);
    writeStored(VIEW_KEY, v);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <PageTitle
        title="Orders"
        description={view === 'board' ? 'Drag a card, or tap its button, to move it along.' : 'Search everything, or browse by status.'}
        actions={
          <>
            <Segmented
              label="Orders view"
              value={view}
              onChange={chooseView}
              items={[
                { value: 'board', label: <><Columns3 /> Board</> },
                { value: 'list', label: <><List /> List</> },
              ]}
            />
            <Link to="/pos" className={buttonClass('cherry', 'md', 'hidden sm:inline-flex')}>
              <Plus /> New sale
            </Link>
          </>
        }
      />
      {view === 'board' ? <OrderBoard /> : <OrderList />}
    </div>
  );
}

function OrderList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab: OrderStatus = isStatus(params.get('tab')) ? (params.get('tab') as OrderStatus) : 'pending';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const [typed, setTyped] = useState(q);
  const search = useDebounced(typed.trim(), 350);
  const { summary } = useOrderSummary();
  const [data, setData] = useState<OrderPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    (patch: { tab?: OrderStatus; page?: number; q?: string }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('view');
          if (patch.tab === 'pending') next.delete('tab');
          else if (patch.tab !== undefined) next.set('tab', patch.tab);
          if (patch.page !== undefined && patch.page > 1) next.set('page', String(patch.page));
          else if (patch.page !== undefined) next.delete('page');
          if (patch.q) next.set('q', patch.q);
          else if (patch.q !== undefined) next.delete('q');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // Debounced search text → URL (and back to page 1).
  useEffect(() => {
    if (search !== q) update({ q: search, page: 1 });
  }, [search, q, update]);

  const load = useCallback(() => {
    const query = search ? { search, page } : { status: tab, page };
    return api
      .get<OrderPageData>('/orders', { params: query })
      .then(({ data: d }) => {
        setData(d);
        setError(null);
        // The page we were on may have emptied (orders moved on): step back.
        const last = Math.max(1, Math.ceil(d.total / (d.pageSize || 20)));
        if (page > last) update({ page: last });
      })
      .catch(() => setError('We couldn’t load the orders.'));
  }, [search, tab, page, update]);

  useEffect(() => {
    void load();
    return onOrdersChanged(() => void load());
  }, [load]);
  useVisiblePoll(() => void load(), 60_000);

  const searching = !!search;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Search name, phone or SC-number"
          aria-label="Search orders"
          className="lg:w-80"
        />
        {!searching && (
          <FilterPills
            label="Order status"
            value={tab}
            onChange={(t) => update({ tab: t, page: 1 })}
            items={STATUSES.map((s) => ({
              value: s.status,
              label: s.label,
              count: summary?.counts[s.status],
              countTone: s.status === 'pending' ? 'cherry' : undefined,
            }))}
          />
        )}
        {searching && <p className="text-sm text-cocoa-soft">Searching every status{data ? ` · ${plural(data.total, 'match', 'matches')}` : ''}</p>}
      </div>

      {error ? (
        <LoadError message={error} onRetry={() => void load()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : data.orders.length === 0 ? (
        <div className="sc-card">
          {searching ? (
            <Empty icon={<SearchX />} title="No orders match" body={`Nothing for “${search}”. Try a phone number or an SC-number.`} />
          ) : (
            <Empty icon={<ClipboardList />} title={`No ${STATUSES.find((s) => s.status === tab)!.label.toLowerCase()} orders`} body="When there are, they’ll be listed here." />
          )}
        </div>
      ) : (
        <>
          <ul className="sc-card divide-y divide-crumb overflow-hidden">
            {data.orders.map((o) => (
              <li key={o._id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${o._id}`)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-plum-50 sm:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.2fr)_90px_auto] sm:py-3.5"
                >
                  <span className="hidden text-sm font-semibold tabular text-plum sm:block">{o.orderNumber}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-cocoa">{customerName(o)}</span>
                    <span className="block truncate text-xs tabular text-cocoa-faint sm:hidden">
                      {o.orderNumber} · {plural(itemCount(o), 'item')}
                    </span>
                    <span className="hidden text-xs text-cocoa-faint sm:block">{plural(itemCount(o), 'item')}{o.isWalkIn ? ' · counter' : ''}</span>
                  </span>
                  <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-2 sm:col-start-auto sm:row-start-auto">
                    <TypeIcon order={o} />
                    <DueTag order={o} className="truncate" />
                  </span>
                  <span className="col-start-2 row-start-1 text-right font-semibold tabular text-cocoa sm:col-start-auto sm:row-start-auto">{formatMoney(o.totalAmount)}</span>
                  <span className="col-start-2 row-start-2 flex justify-end gap-1.5 sm:col-start-auto sm:row-start-auto">
                    {searching && <StatusPill status={o.status} />}
                    <PaymentPill order={o} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={data.page || page} pageSize={data.pageSize || 20} total={data.total} onPage={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
