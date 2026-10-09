import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Plus, SearchX } from 'lucide-react';
import api, { errorMessage } from '../lib/api';
import { cachedGet, invalidateCache } from '../lib/cache';
import { COLLECTIONS, COLLECTION_INFO, isCollection, startingPrice, type Collection, type MenuItem } from '../lib/menu';
import { cn, formatMoney } from '../lib/utils';
import { Empty, FilterPills, LoadError, PageTitle, Pill, Skeleton } from '../components/ui/Bits';
import { buttonClass } from '../components/ui/buttonStyles';
import { SearchInput } from '../components/ui/Field';
import { Switch } from '../components/ui/Switch';

export function MenuPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section: Collection = isCollection(params.get('section')) ? (params.get('section') as Collection) : 'cakes';
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const load = (force = false) =>
    cachedGet<{ items: MenuItem[] }>('/menu/all', undefined, { force })
      .then((d) => {
        setItems(d.items);
        setError(false);
      })
      .catch(() => setError(true));

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const out = {} as Record<Collection, { total: number; hidden: number }>;
    for (const c of COLLECTIONS) {
      const list = (items ?? []).filter((i) => i.section === c);
      out[c] = { total: list.length, hidden: list.filter((i) => !i.available).length };
    }
    return out;
  }, [items]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, MenuItem[]>();
    for (const item of items ?? []) {
      if (item.section !== section) continue;
      if (q && !`${item.name} ${item.category} ${item.description ?? ''}`.toLowerCase().includes(q)) continue;
      const key = item.category || 'Uncategorised';
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cat, list]) => [cat, list.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [items, section, query]);

  const setAvailable = async (item: MenuItem, available: boolean) => {
    setItems((list) => list?.map((i) => (i._id === item._id ? { ...i, available } : i)) ?? list);
    try {
      const fd = new FormData();
      fd.append('available', String(available));
      await api.put(`/menu/${item._id}`, fd);
      invalidateCache('/menu');
      toast.success(available ? `${item.name} is on the website` : `${item.name} is hidden from the website`, { id: `avail-${item._id}` });
    } catch (err) {
      setItems((list) => list?.map((i) => (i._id === item._id ? { ...i, available: !available } : i)) ?? list);
      toast.error(errorMessage(err, 'Couldn’t change that. Please try again.'));
    }
  };

  const info = COLLECTION_INFO[section];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <PageTitle
        title="Menu"
        description="What customers can order on the website. Hide an item to take it off without deleting it."
        actions={
          <Link to={`/menu/new?section=${section}`} className={buttonClass('primary')}>
            <Plus /> Add item
          </Link>
        }
      />

      <FilterPills
        label="Collection"
        value={section}
        onChange={(c) => setParams({ section: c }, { replace: true })}
        items={COLLECTIONS.map((c) => {
          const Icon = COLLECTION_INFO[c].icon;
          return {
            value: c,
            label: (
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4" aria-hidden />
                {COLLECTION_INFO[c].label}
                {items && stats[c].hidden > 0 && <span className="text-xs font-medium opacity-75">· {stats[c].hidden} hidden</span>}
              </span>
            ),
            count: items ? stats[c].total : undefined,
          };
        })}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-cocoa-soft">{info.blurb}.</p>
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${info.label.toLowerCase()}`} aria-label="Search the menu" className="sm:w-72" />
      </div>

      {error && !items ? (
        <LoadError message="We couldn’t load the menu." onRetry={() => void load(true)} />
      ) : !items ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="sc-card">
          {query ? (
            <Empty icon={<SearchX />} title="No matches" body={`Nothing in ${info.label} matches “${query}”.`} />
          ) : (
            <Empty
              icon={<info.icon />}
              title={`No ${info.label.toLowerCase()} yet`}
              body="Add the first one and it appears on the website straight away."
              action={
                <Link to={`/menu/new?section=${section}`} className={buttonClass('primary')}>
                  <Plus /> Add a {info.noun}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="sc-card overflow-hidden">
          <div className="hidden grid-cols-[56px_minmax(0,2fr)_minmax(0,1fr)_110px_minmax(0,1.4fr)_96px] items-center gap-4 border-b border-crumb bg-cream-deep/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-cocoa-faint md:grid">
            <span />
            <span>Item</span>
            <span>Category</span>
            <span>Price</span>
            <span>Options</span>
            <span className="text-right">On site</span>
          </div>
          {groups.map(([category, list]) => (
            <section key={category} aria-label={category}>
              <h2 className="sticky top-16 z-10 border-b border-crumb bg-peach-50/95 px-4 py-2 font-display text-[15px] font-semibold text-peach-700 backdrop-blur lg:top-0">
                {category} <span className="font-sans text-xs font-medium text-cocoa-faint">· {list.length}</span>
              </h2>
              <ul className="divide-y divide-crumb">
                {list.map((item) => {
                  const price = startingPrice(item);
                  const groupsSummary = (item.optionGroups ?? []).map((g) => `${g.name} (${g.options.length})`).join(', ');
                  return (
                    <li
                      key={item._id}
                      className={cn(
                        'grid cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-plum-50 md:grid-cols-[56px_minmax(0,2fr)_minmax(0,1fr)_110px_minmax(0,1.4fr)_96px] md:gap-4',
                        !item.available && 'bg-cream-deep/40'
                      )}
                      onClick={() => navigate(`/menu/${item._id}`)}
                    >
                      <span className={cn('row-span-2 size-14 overflow-hidden rounded-md bg-peach-50 md:row-span-1', !item.available && 'opacity-50 grayscale')}>
                        {item.image ? (
                          <img src={item.image} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-peach-700">
                            <info.icon className="size-6" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <Link
                          to={`/menu/${item._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-semibold text-cocoa hover:text-plum focus-visible:text-plum"
                        >
                          {item.name}
                        </Link>
                        <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {item.popular && (
                            <Pill tone="cherry">
                              <Heart className="fill-current" /> Favourite
                            </Pill>
                          )}
                          {!item.available && <Pill tone="neutral">Hidden</Pill>}
                          <span className="text-sm tabular text-cocoa-soft md:hidden">
                            {price.from ? 'from ' : ''}
                            {formatMoney(price.amount)}
                          </span>
                        </span>
                      </span>
                      <span className="hidden truncate text-sm text-cocoa-soft md:block">{item.category}</span>
                      <span className="hidden text-sm font-semibold tabular text-cocoa md:block">
                        {price.from && <span className="font-normal text-cocoa-faint">from </span>}
                        {formatMoney(price.amount)}
                      </span>
                      <span className="col-start-2 truncate text-sm text-cocoa-faint md:col-start-auto">
                        {groupsSummary || 'No options'}
                        {item.minQuantity > 1 ? ` · min ${item.minQuantity}` : ''}
                      </span>
                      <span
                        className="col-start-3 row-span-2 row-start-1 flex justify-end md:col-start-auto md:row-span-1 md:row-start-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch checked={item.available} onCheckedChange={(v) => void setAvailable(item, v)} label={`Show ${item.name} on the website`} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
