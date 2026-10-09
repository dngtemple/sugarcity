import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, ClipboardList, Hourglass, Package, RotateCcw, SearchX } from 'lucide-react';
import api from '../lib/api';
import { onOrdersChanged } from '../lib/events';
import {
  PAYMENT_FILTERS,
  PRESETS,
  STATUS_FILTERS,
  TYPE_FILTERS,
  customerName,
  defaultSalesFilters,
  presetOf,
  presetRange,
  type SalesFilters,
  type SalesReport,
} from '../lib/orders';
import { collectionLabel } from '../lib/menu';
import { cn, formatDateTime, formatMoney, plural } from '../lib/utils';
import { Card, Empty, LoadError, PageTitle, Pager, Skeleton } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Field, Select } from '../components/ui/Field';
import { DatePicker } from '../components/ui/DatePicker';
import { PaymentPill, StatusPill } from '../components/orders/OrderBits';

const SEGMENT_COLOURS: Record<string, { bar: string; dot: string }> = {
  cakes: { bar: 'bg-plum', dot: 'bg-plum' },
  pastries: { bar: 'bg-peach-700', dot: 'bg-peach-700' },
  gifts: { bar: 'bg-cherry', dot: 'bg-cherry' },
  other: { bar: 'bg-cocoa-faint', dot: 'bg-cocoa-faint' },
};
const SEGMENT_ORDER = ['cakes', 'pastries', 'gifts', 'other'];

export function SalesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SalesFilters>(defaultSalesFilters);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const preset = presetOf(filters.from, filters.to);
  const defaults = defaultSalesFilters();
  const changed = JSON.stringify(filters) !== JSON.stringify(defaults);

  const setFilter = (patch: Partial<SalesFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setLoading(true);
  };
  const goPage = (p: number) => {
    setPage(p);
    setLoading(true);
  };

  const load = useCallback(() => {
    return api
      .get<SalesReport>('/orders/sales', {
        params: {
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          payment: filters.payment,
          type: filters.type,
          status: filters.status,
          page,
        },
      })
      .then(({ data }) => {
        setReport(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    void load();
    return onOrdersChanged(() => void load());
  }, [load]);

  const segments = useMemo(() => {
    const rows = report?.bySection ?? [];
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return SEGMENT_ORDER.map((key) => {
      const row = rows.find((r) => (r.section || 'other') === key);
      return { key, label: collectionLabel(key), amount: row?.amount ?? 0, items: row?.items ?? 0, share: total > 0 ? (row?.amount ?? 0) / total : 0 };
    }).filter((s) => s.amount > 0 || s.key !== 'other');
  }, [report]);
  const segmentTotal = segments.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <PageTitle title="Sales" description="Takings count paid orders only. Unpaid money is shown separately." />

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <PresetPill key={p.key} active={preset === p.key} onClick={() => setFilter(presetRange(p.key))}>
              {p.label}
            </PresetPill>
          ))}
          <PresetPill active={preset === 'custom'} onClick={() => document.getElementById('sales-from')?.click()}>
            Custom
          </PresetPill>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From" htmlFor="sales-from">
            <DatePicker id="sales-from" value={filters.from} max={filters.to || undefined} onChange={(from) => setFilter({ from })} placeholder="The beginning" clearable />
          </Field>
          <Field label="To" htmlFor="sales-to">
            <DatePicker id="sales-to" value={filters.to} min={filters.from || undefined} onChange={(to) => setFilter({ to })} placeholder="Today" clearable />
          </Field>
          <Field label="Payment" htmlFor="sales-payment">
            <Select id="sales-payment" value={filters.payment} onChange={(payment) => setFilter({ payment })} options={PAYMENT_FILTERS} />
          </Field>
          <Field label="Order type" htmlFor="sales-type">
            <Select id="sales-type" value={filters.type} onChange={(type) => setFilter({ type })} options={TYPE_FILTERS} />
          </Field>
          <Field label="Status" htmlFor="sales-status">
            <Select id="sales-status" value={filters.status} onChange={(status) => setFilter({ status })} options={STATUS_FILTERS} />
          </Field>
        </div>
        {changed && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters(defaultSalesFilters()); setPage(1); }}>
            <RotateCcw /> Reset to this month
          </Button>
        )}
      </Card>

      {error && !report ? (
        <LoadError message="We couldn’t load the sales report." onRetry={() => void load()} />
      ) : (
        <>
          <section aria-label="Totals" className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', loading && report && 'opacity-60')}>
            <Stat icon={<Banknote />} label="Takings (paid)" value={report ? formatMoney(report.totals.sales) : null} tone="mint" />
            <Stat icon={<Hourglass />} label="Unpaid" value={report ? formatMoney(report.totals.unpaid) : null} tone="honey" />
            <Stat icon={<ClipboardList />} label="Orders" value={report ? String(report.totals.orders) : null} />
            <Stat icon={<Package />} label="Items sold" value={report ? String(report.totals.items) : null} />
          </section>

          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-cocoa">By collection</h2>
            {!report ? (
              <Skeleton className="mt-4 h-24" />
            ) : segmentTotal === 0 ? (
              <p className="mt-2 text-[15px] text-cocoa-soft">No sales in this range yet.</p>
            ) : (
              <>
                <div className="mt-4 flex h-5 w-full overflow-hidden rounded-full bg-cream-deep" role="img" aria-label={segments.map((s) => `${s.label} ${formatMoney(s.amount)}`).join(', ')}>
                  {segments
                    .filter((s) => s.share > 0)
                    .map((s) => (
                      <span key={s.key} className={cn('h-full border-r-2 border-card last:border-r-0', SEGMENT_COLOURS[s.key].bar)} style={{ width: `${s.share * 100}%` }} title={`${s.label}: ${formatMoney(s.amount)}`} />
                    ))}
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {segments.map((s) => (
                    <li key={s.key} className="flex items-start gap-2.5">
                      <span className={cn('mt-1.5 size-3 shrink-0 rounded-full', SEGMENT_COLOURS[s.key].dot)} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-cocoa-soft">{s.label}</span>
                        <span className="block font-semibold tabular text-cocoa">{formatMoney(s.amount)}</span>
                        <span className="block text-xs tabular text-cocoa-faint">
                          {plural(s.items, 'item')} · {Math.round(s.share * 100)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
              <h2 className="font-display text-lg font-semibold text-cocoa">Orders in this report</h2>
              {report && <span className="text-sm tabular text-cocoa-faint">{plural(report.total, 'order')}</span>}
            </div>
            {!report ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : report.orders.length === 0 ? (
              <Empty icon={<SearchX />} title="No orders here" body="Try a wider date range or fewer filters." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="mt-3 w-full min-w-[640px] text-left text-[15px]">
                    <thead className="border-y border-crumb bg-cream-deep/60 text-xs font-semibold uppercase tracking-wider text-cocoa-faint">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 sm:pl-5">Order</th>
                        <th scope="col" className="px-3 py-2.5">Placed</th>
                        <th scope="col" className="px-3 py-2.5">Customer</th>
                        <th scope="col" className="px-3 py-2.5">Status</th>
                        <th scope="col" className="px-3 py-2.5 text-right sm:pr-5">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-crumb">
                      {report.orders.map((o) => (
                        <tr
                          key={o._id}
                          tabIndex={0}
                          onClick={() => navigate(`/orders/${o._id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/orders/${o._id}`);
                            }
                          }}
                          className="cursor-pointer transition-colors hover:bg-plum-50 focus-visible:bg-plum-50"
                        >
                          <td className="px-4 py-3 font-semibold tabular text-plum sm:pl-5">{o.orderNumber}</td>
                          <td className="px-3 py-3 tabular text-cocoa-soft">{formatDateTime(o.createdAt)}</td>
                          <td className="px-3 py-3">
                            <span className="block font-medium text-cocoa">{customerName(o)}</span>
                            <span className="block text-xs text-cocoa-faint">{o.isWalkIn ? 'Counter' : 'Website'} · {o.orderType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex flex-wrap gap-1.5">
                              <StatusPill status={o.status} />
                              <PaymentPill order={o} />
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular text-cocoa sm:pr-5">{formatMoney(o.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-4 sm:px-5">
                  <Pager page={report.page || page} pageSize={report.pageSize || 20} total={report.total} onPage={goPage} />
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function PresetPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full px-4 text-sm font-semibold transition-colors',
        active ? 'bg-plum text-cream shadow-soft' : 'bg-cream-deep text-cocoa-soft hover:bg-plum-50 hover:text-plum'
      )}
    >
      {children}
    </button>
  );
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | null; tone?: 'mint' | 'honey' }) {
  return (
    <div className="sc-card p-4 sm:p-5">
      <span
        className={cn(
          'mb-2 flex size-9 items-center justify-center rounded-full [&_svg]:size-[18px]',
          tone === 'mint' ? 'bg-mint-50 text-mint' : tone === 'honey' ? 'bg-honey-50 text-honey-700' : 'bg-plum-50 text-plum'
        )}
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-cocoa-soft">{label}</p>
      {value === null ? <Skeleton className="mt-1 h-8 w-24" /> : <p className="font-display text-2xl font-semibold tabular text-cocoa">{value}</p>}
    </div>
  );
}
