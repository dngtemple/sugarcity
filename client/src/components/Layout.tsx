import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMenu } from '../stores/menuStore';
import { Header } from './Header';
import { Footer } from './Footer';
import { TabBar } from './TabBar';
import { BagDrawer } from './BagDrawer';

/** "/menu/cakes/123" → "/menu/cakes": opening or closing a treat keeps the menu's scroll. */
const scrollKey = (path: string) => {
  const m = path.match(/^\/menu\/[^/]+/);
  return m ? m[0] : path;
};

function ScrollManager() {
  const { pathname } = useLocation();
  const last = useRef(scrollKey(pathname));
  useEffect(() => {
    const key = scrollKey(pathname);
    if (key !== last.current) window.scrollTo(0, 0);
    last.current = key;
  }, [pathname]);
  return null;
}

export function Layout() {
  const load = useMenu((s) => s.load);
  const { pathname } = useLocation();
  useEffect(() => load(), [load]);

  const focused = pathname.startsWith('/checkout');

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-full bg-plum px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <ScrollManager />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {!focused && <TabBar />}
      <BagDrawer />
    </div>
  );
}
