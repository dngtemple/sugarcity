import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { Gift, Truck } from 'lucide-react';
import { useMenu } from '../stores/menuStore';
import { categoriesOf, categoryId, isSection, SECTIONS, SECTION_INFO, type Section } from '../lib/menu';
import { cn } from '../lib/utils';
import { TreatCard } from '../components/TreatCard';
import { MenuError, SlowNote } from '../components/LoadState';
import { Skeleton } from '../components/ui/bits';

function CollectionSwitch({ active }: { active: Section }) {
  return (
    <nav aria-label="Collections" className="flex justify-center">
      <div className="inline-flex w-full max-w-xl rounded-full bg-cream-deep p-1 shadow-inner ring-1 ring-crumb">
        {SECTIONS.map((s) => {
          const Icon = SECTION_INFO[s].icon;
          return (
            <NavLink
              key={s}
              to={`/menu/${s}`}
              aria-current={s === active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition sm:text-[15px]',
                s === active ? 'bg-plum text-cream shadow-soft' : 'text-cocoa-soft hover:text-plum'
              )}
            >
              <Icon className="hidden size-4 min-[400px]:block" aria-hidden />
              <span className="sm:hidden">{SECTION_INFO[s].short}</span>
              <span className="hidden sm:inline">{SECTION_INFO[s].label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Tracks which category heading is in view. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '-140px 0px -55% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active ?? ids[0] ?? null;
}

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function CategoryChips({ categories, ids, active }: { categories: string[]; ids: string[]; active: string | null }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chip = bar.current?.querySelector<HTMLElement>(`[data-target="${active}"]`);
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);
  return (
    <div className="sticky top-[68px] z-30 -mx-4 border-b border-crumb/70 bg-cream/90 px-4 py-2.5 backdrop-blur-md md:hidden">
      <div ref={bar} className="flex gap-2 overflow-x-auto scrollbar-none" role="list" aria-label="Categories">
        {categories.map((c, i) => (
          <button
            key={c}
            type="button"
            role="listitem"
            data-target={ids[i]}
            onClick={() => jumpTo(ids[i])}
            aria-current={active === ids[i] ? 'true' : undefined}
            className={cn(
              'min-h-10 shrink-0 rounded-full border-2 px-4 text-sm font-semibold transition',
              active === ids[i] ? 'border-plum bg-plum text-cream' : 'border-crumb bg-card text-cocoa-soft'
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategorySidebar({ categories, ids, active, counts }: { categories: string[]; ids: string[]; active: string | null; counts: number[] }) {
  return (
    <aside className="hidden md:block">
      <nav aria-label="Categories" className="sticky top-[92px] rounded-xl bg-card p-3 shadow-soft ring-1 ring-crumb/60">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cocoa-faint">Categories</p>
        <ul className="space-y-0.5">
          {categories.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => jumpTo(ids[i])}
                aria-current={active === ids[i] ? 'true' : undefined}
                className={cn(
                  'relative flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-[15px] transition',
                  active === ids[i] ? 'bg-plum-50 font-semibold text-plum' : 'text-cocoa-soft hover:bg-cream-deep hover:text-cocoa'
                )}
              >
                {active === ids[i] && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-cherry" aria-hidden />}
                <span>{c}</span>
                <span className="tabular text-xs text-cocoa-faint">{counts[i]}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3" aria-label="Loading the menu">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-lg bg-card p-2 shadow-soft">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function SectionMenu({ section }: { section: Section }) {
  const { status, items } = useMenu();
  const list = useMemo(() => items.filter((i) => i.section === section), [items, section]);
  const categories = useMemo(() => categoriesOf(list), [list]);
  const ids = useMemo(() => categories.map((c) => categoryId(section, c)), [categories, section]);
  const counts = categories.map((c) => list.filter((i) => i.category === c).length);
  const active = useScrollSpy(ids);
  const info = SECTION_INFO[section];

  const loading = status === 'idle' || status === 'loading';

  return (
    <>
      <header className="mt-8 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-plum sm:text-5xl">{info.label}</h1>
        <p className="mt-2 text-cocoa-soft">{info.blurb}</p>
      </header>

      {section === 'gifts' && (
        <div className="mx-auto mt-6 flex max-w-2xl items-center gap-3 rounded-lg bg-peach-50 p-4 ring-1 ring-peach">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-cherry shadow-soft">
            <Gift className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-cocoa">
            <strong className="font-semibold">Sending a surprise?</strong> Gift boxes go straight to the lucky person. Add their name and number at checkout, plus a card
            message if you like.
          </p>
          <Truck className="hidden size-6 shrink-0 text-peach-700 sm:block" aria-hidden />
        </div>
      )}

      {loading && list.length === 0 ? (
        <div className="mt-8">
          <GridSkeleton />
          <SlowNote />
        </div>
      ) : status === 'error' && list.length === 0 ? (
        <div className="mt-10">
          <MenuError />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-10">
          <MenuError title="Fresh batch coming soon" body={`There’s nothing in ${info.label} right now. Message us and we’ll see what we can whip up.`} />
        </div>
      ) : (
        <>
          {categories.length > 1 && <CategoryChips categories={categories} ids={ids} active={active} />}
          <div className={cn('mt-6 gap-8', categories.length > 1 && 'md:grid md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]')}>
            {categories.length > 1 && <CategorySidebar categories={categories} ids={ids} active={active} counts={counts} />}
            <div className="min-w-0 space-y-12">
              {categories.map((c, i) => (
                <section key={c} id={ids[i]} aria-labelledby={`${ids[i]}-h`} className="scroll-mt-36 md:scroll-mt-24">
                  <h2 id={`${ids[i]}-h`} className="mb-4 flex items-center gap-3 font-display text-2xl font-semibold text-plum">
                    {c}
                    <span className="h-px flex-1 bg-gradient-to-r from-crumb-strong to-transparent" aria-hidden />
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                    {list
                      .filter((item) => item.category === c)
                      .map((item) => (
                        <TreatCard key={item._id} item={item} />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function MenuPage() {
  const { section } = useParams();
  if (!isSection(section)) return <Navigate to={`/menu/${SECTIONS[0]}`} replace />;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <CollectionSwitch active={section} />
      <SectionMenu key={section} section={section} />
      <Outlet />
    </div>
  );
}
