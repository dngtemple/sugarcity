import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShoppingBasket,
  UtensilsCrossed,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../stores/auth';
import { useLowStockCount, useOrderSummary } from '../../lib/useCounts';
import { cn, firstName, keepOpenForToasts, readStored, writeStored } from '../../lib/utils';
import { LogoBadge } from './Brand';
import { InstallButton } from './InstallApp';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/pos', label: 'New sale', icon: ShoppingBasket },
  { to: '/sales', label: 'Sales', icon: BarChart3 },
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/inventory', label: 'Stock', icon: Warehouse },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const COLLAPSE_KEY = 'sc-admin-sidebar-collapsed';

function titleFor(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/orders/')) return 'Order';
  if (pathname.startsWith('/menu/')) return 'Menu item';
  if (pathname.startsWith('/inventory/history')) return 'Stock history';
  return NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to))?.label ?? 'Studio';
}

/**
 * The Studio frame: a plum sidebar on desktop (collapsible to an icon rail),
 * and on phones a cream top bar with a slide-in drawer.
 */
export function StudioShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const { summary } = useOrderSummary();
  const lowStock = useLowStockCount();
  const newOrders = summary?.counts.pending ?? 0;
  const [collapsed, setCollapsed] = useState(() => readStored<boolean>(COLLAPSE_KEY, false));
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = newOrders > 0 ? `(${newOrders}) Sugar City Studio` : 'Sugar City Studio';
  }, [newOrders]);

  // Every page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeStored(COLLAPSE_KEY, !c);
      return !c;
    });
  };

  const leave = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const badgeFor = (to: string): { n: number; className: string; label: string } | null => {
    if (to === '/orders' && newOrders > 0) return { n: newOrders, className: 'bg-cherry text-white', label: `${newOrders} new` };
    if (to === '/inventory' && lowStock > 0) return { n: lowStock, className: 'bg-honey-200 text-honey-700', label: `${lowStock} running low` };
    return null;
  };

  return (
    <div className="min-h-dvh bg-cream">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* ------------------------------------------------ desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col bg-plum-900 text-cream transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[84px]' : 'w-64'
        )}
        aria-label="Studio navigation"
      >
        <div className={cn('flex items-center gap-3 px-5 pb-4 pt-5', collapsed && 'justify-center px-0')}>
          <LogoBadge size={collapsed ? 44 : 48} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight">Sugar City</p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-peach">Studio</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-none">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} collapsed={collapsed} badge={badgeFor(item.to)} />
          ))}
        </nav>

        <div className={cn('space-y-2 border-t border-white/10 p-3', collapsed && 'flex flex-col items-center')}>
          <InstallButton onDark compact={collapsed} className={collapsed ? '' : 'w-full'} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn('flex min-h-11 items-center gap-3 rounded-full text-sm font-medium text-cream/70 hover:bg-white/10 hover:text-cream', collapsed ? 'w-11 justify-center' : 'w-full px-4')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : undefined}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            {!collapsed && 'Collapse'}
          </button>
          <UserCard name={user?.name ?? ''} email={user?.email ?? ''} collapsed={collapsed} onSignOut={leave} />
        </div>
      </aside>

      {/* ------------------------------------------------ phone top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-crumb bg-cream/95 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative inline-flex size-11 items-center justify-center rounded-full text-plum hover:bg-plum-50"
          aria-label={`Open menu${newOrders ? ` (${newOrders} new orders)` : ''}`}
        >
          <MenuIcon className="size-6" />
          {newOrders > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-cherry ring-2 ring-cream" aria-hidden />}
        </button>
        <Link to="/" aria-label="Dashboard" className="shrink-0">
          <LogoBadge size={36} />
        </Link>
        <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-plum">{titleFor(pathname)}</p>
        <Link
          to="/pos"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-cherry text-white shadow-lift active:scale-95"
          aria-label="New sale"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </Link>
      </header>

      {/* ------------------------------------------------ phone drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-plum-900/50 animate-fade lg:hidden" />
          <Dialog.Content
            onInteractOutside={keepOpenForToasts}
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col bg-plum-900 text-cream shadow-lift animate-drawer-left focus:outline-none lg:hidden"
          >
            <div className="flex items-center gap-3 px-4 pb-3 pt-4">
              <LogoBadge size={44} />
              <div className="min-w-0 flex-1">
                <Dialog.Title className="font-display text-lg font-semibold leading-tight">Sugar City</Dialog.Title>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-peach">Studio</p>
              </div>
              <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-full text-cream/80 hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Studio navigation">
              {NAV.map((item) => (
                <SideLink key={item.to} item={item} badge={badgeFor(item.to)} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </nav>
            <div className="space-y-2 border-t border-white/10 p-3 pb-safe">
              <InstallButton onDark className="w-full" />
              <UserCard name={user?.name ?? ''} email={user?.email ?? ''} onSignOut={leave} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main id="main" className={cn('min-w-0 transition-[padding] duration-200', collapsed ? 'lg:pl-[84px]' : 'lg:pl-64')}>
        <Outlet />
      </main>
    </div>
  );
}

function SideLink({
  item,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavEntry;
  collapsed?: boolean;
  badge: { n: number; className: string; label: string } | null;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? `${item.label}${badge ? `, ${badge.label}` : ''}` : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-12 items-center gap-3 rounded-full text-[15px] font-semibold transition-colors',
          collapsed ? 'mx-auto w-12 justify-center' : 'px-4',
          isActive ? 'bg-peach text-plum-900 shadow-soft' : 'text-cream/80 hover:bg-white/10 hover:text-cream'
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {badge &&
        (collapsed ? (
          <span className={cn('absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center text-[11px] font-bold leading-5 tabular ring-2 ring-plum-900', badge.className)}>
            {badge.n > 99 ? '99+' : badge.n}
          </span>
        ) : (
          <Badge className={badge.className} label={badge.label}>
            {badge.n > 99 ? '99+' : badge.n}
          </Badge>
        ))}
    </NavLink>
  );
}

function Badge({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <span className={cn('min-w-6 rounded-full px-2 text-center text-xs font-bold leading-6 tabular', className)}>
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function UserCard({ name, email, collapsed, onSignOut }: { name: string; email: string; collapsed?: boolean; onSignOut: () => void }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex size-11 items-center justify-center rounded-full text-cream/70 hover:bg-white/10 hover:text-cream"
        aria-label={`Sign out ${firstName(name)}`}
        title="Sign out"
      >
        <LogOut className="size-5" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peach font-display text-sm font-bold text-plum-900" aria-hidden>
        {initials || 'SC'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name || 'Signed in'}</p>
        <p className="truncate text-xs text-cream/60">{email}</p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-cream/70 hover:bg-white/10 hover:text-cream"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-5" />
      </button>
    </div>
  );
}
