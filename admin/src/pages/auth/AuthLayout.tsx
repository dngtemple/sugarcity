import type { ReactNode } from 'react';
import { LogoBadge } from '../../components/shell/Brand';

/** Split screen: a plum welcome panel on the left, the form card on the right. */
export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-cream lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-plum-900 bg-sprinkles px-6 py-8 text-cream sm:px-10 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-plum/60 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-80 rounded-full bg-peach/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <LogoBadge size={56} round className="ring-4 ring-white/15" />
          <div>
            <p className="font-display text-lg font-semibold leading-tight">Sugar City</p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-peach">Studio</p>
          </div>
        </div>
        <div className="relative mt-8 max-w-md lg:mt-0">
          <h1 className="font-display text-[34px] font-semibold leading-[1.1] sm:text-5xl">Welcome back to the Studio</h1>
          <p className="mt-3 hidden text-lg text-cream/75 sm:block">Orders, counter sales, the menu and the stock room — all in one sweet spot.</p>
        </div>
        <p className="relative mt-8 hidden text-sm text-cream/50 lg:block">Baked for your sweetest moments.</p>
      </section>

      <section className="flex items-start justify-center px-4 py-8 sm:items-center sm:px-8">
        <div className="w-full max-w-md animate-rise rounded-xl border border-crumb bg-card p-6 shadow-lift sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-plum">{title}</h2>
          {intro && <div className="mt-1.5 text-[15px] text-cocoa-soft">{intro}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  );
}
