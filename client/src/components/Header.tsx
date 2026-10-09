import { Link, NavLink } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { bagCount, useBag } from '../stores/bagStore';
import { cn } from '../lib/utils';
import { Logo } from './ui/bits';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/menu', label: 'Menu', end: false },
  { to: '/track', label: 'Track order', end: false },
];

export function Header() {
  const count = useBag((s) => bagCount(s.lines));
  const setOpen = useBag((s) => s.setOpen);

  return (
    <header className="sticky top-0 z-40 border-b border-crumb/70 bg-cream/80 backdrop-blur-md supports-[backdrop-filter]:bg-cream/70">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="Sugar City home">
          <Logo className="h-12 w-12 rounded-full bg-white p-0.5 shadow-soft" />
          <span className="font-display text-xl font-semibold tracking-tight text-plum">Sugar City</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-plum-50 text-plum' : 'text-cocoa-soft hover:bg-cream-deep hover:text-cocoa'
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative ml-auto hidden h-11 items-center gap-2 rounded-full border-2 border-plum/15 bg-card pl-4 pr-5 font-semibold text-plum transition hover:border-plum/35 active:scale-95 md:ml-2 md:inline-flex"
          aria-label={`Open your bag, ${count} ${count === 1 ? 'treat' : 'treats'}`}
        >
          <ShoppingBag className="size-5" aria-hidden />
          Bag
          {count > 0 && (
            <span className="tabular absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-cherry px-1.5 text-xs font-bold text-white ring-2 ring-cream">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
