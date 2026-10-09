import { NavLink } from 'react-router-dom';
import { Home, PackageSearch, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { bagCount, useBag } from '../stores/bagStore';
import { cn } from '../lib/utils';

function Tab({ icon: Icon, label, active, badge }: { icon: LucideIcon; label: string; active: boolean; badge?: number }) {
  return (
    <span className="relative flex h-14 min-w-14 flex-col items-center justify-center gap-0.5 px-1">
      <span className="relative">
        <Icon className={cn('size-[22px] transition', active ? 'text-peach' : 'text-cream/75')} aria-hidden strokeWidth={active ? 2.3 : 1.8} />
        {!!badge && (
          <span className="tabular absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cherry px-1 text-[10px] font-bold text-white ring-2 ring-plum">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className={cn('text-[10px] font-medium tracking-wide', active ? 'text-cream' : 'text-cream/70')}>{label}</span>
      <span className={cn('absolute bottom-1 size-1 rounded-full bg-peach transition-opacity', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
    </span>
  );
}

/** Floating pill navigation for phones. */
export function TabBar() {
  const count = useBag((s) => bagCount(s.lines));
  const open = useBag((s) => s.open);
  const setOpen = useBag((s) => s.setOpen);

  const item = 'flex flex-1 justify-center rounded-full focus-visible:outline-peach';
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 z-40 flex justify-center px-4 md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="flex w-full max-w-sm items-center rounded-full bg-plum px-2 shadow-lift ring-1 ring-white/10">
        <NavLink to="/" end className={item}>
          {({ isActive }) => <Tab icon={Home} label="Home" active={isActive && !open} />}
        </NavLink>
        <NavLink to="/menu" className={item}>
          {({ isActive }) => <Tab icon={UtensilsCrossed} label="Menu" active={isActive && !open} />}
        </NavLink>
        <NavLink to="/track" className={item}>
          {({ isActive }) => <Tab icon={PackageSearch} label="Track" active={isActive && !open} />}
        </NavLink>
        <button type="button" className={item} onClick={() => setOpen(true)} aria-label={`Bag, ${count} ${count === 1 ? 'treat' : 'treats'}`}>
          <Tab icon={ShoppingBag} label="Bag" active={open} badge={count} />
        </button>
      </div>
    </nav>
  );
}
