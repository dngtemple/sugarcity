import type { ComponentProps, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export type Tone = 'plum' | 'cherry' | 'peach' | 'mint' | 'honey' | 'berry' | 'sky' | 'neutral';

const TONES: Record<Tone, string> = {
  plum: 'bg-plum-50 text-plum ring-plum-200',
  cherry: 'bg-cherry-50 text-cherry-700 ring-cherry/25',
  peach: 'bg-peach-50 text-peach-700 ring-peach',
  mint: 'bg-mint-50 text-mint-700 ring-mint/20',
  honey: 'bg-honey-50 text-honey-700 ring-honey-200',
  berry: 'bg-berry-50 text-berry-700 ring-berry/25',
  sky: 'bg-sky-50 text-sky-700 ring-sky-700/20',
  neutral: 'bg-cream-deep text-cocoa-soft ring-crumb-strong',
};

/** A small rounded label: statuses, payment, flags. */
export function Pill({ tone = 'neutral', className, children, ...props }: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset [&_svg]:size-3.5',
        TONES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Page title block used at the top of every Studio page. */
export function PageTitle({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="sc-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-[28px] font-semibold leading-tight text-plum sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-cocoa-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('sc-card', className)} {...props} />;
}

export function CardTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <span className="text-plum [&_svg]:size-[18px]">{icon}</span>}
      <h2 className="flex-1 font-display text-lg font-semibold text-cocoa">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-peach-50 text-peach-700 [&_svg]:size-6">{icon}</span>}
      <p className="font-display text-lg font-semibold text-cocoa">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[15px] text-cocoa-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-cream-deep', className)} aria-hidden />;
}

/** Loading / error states for a block of content. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="sc-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-semibold text-cocoa">{message}</p>
      <button type="button" onClick={onRetry} className="sc-link min-h-11">
        Try again
      </button>
    </div>
  );
}

/**
 * Pill-shaped filter tabs with optional counts. Arrow keys move between them.
 */
export function FilterPills<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode; count?: number; countTone?: 'cherry' | 'honey' }[];
  label: string;
  className?: string;
}) {
  const move = (dir: number, current: number) => {
    const next = items[(current + dir + items.length) % items.length];
    onChange(next.value);
    requestAnimationFrame(() => document.getElementById(`pill-${label}-${next.value}`)?.focus());
  };
  return (
    <div role="tablist" aria-label={label} className={cn('-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 scrollbar-none', className)}>
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            id={`pill-${label}-${item.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1, i);
              if (e.key === 'ArrowLeft') move(-1, i);
            }}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
              active ? 'bg-plum text-cream shadow-soft' : 'bg-card text-cocoa-soft ring-1 ring-inset ring-crumb hover:text-plum hover:ring-plum-200'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'min-w-6 rounded-full px-1.5 text-xs tabular leading-5',
                  active
                    ? 'bg-white/20 text-cream'
                    : item.countTone === 'cherry' && item.count > 0
                      ? 'bg-cherry text-white'
                      : item.countTone === 'honey' && item.count > 0
                        ? 'bg-honey-200 text-honey-700'
                        : 'bg-cream-deep text-cocoa-soft'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** "Showing 21–40 of 63" with previous / next and page numbers. */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const numbers: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }
  const btn = 'inline-flex size-11 items-center justify-center rounded-full text-sm font-semibold tabular transition-colors';
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-sm tabular text-cocoa-soft">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(btn, 'text-cocoa-soft hover:bg-plum-50 disabled:opacity-30')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-5" />
        </button>
        {numbers.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="hidden w-6 text-center text-cocoa-faint sm:inline">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cn(btn, 'hidden sm:inline-flex', n === page ? 'bg-plum text-cream' : 'text-cocoa-soft hover:bg-plum-50')}
            >
              {n}
            </button>
          )
        )}
        <span className="px-2 text-sm tabular text-cocoa-soft sm:hidden">
          {page} / {pages}
        </span>
        <button type="button" className={cn(btn, 'text-cocoa-soft hover:bg-plum-50 disabled:opacity-30')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </nav>
  );
}

/** − n + with typing; keeps within min..max. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 1000,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-full bg-cream-deep p-0.5', size === 'sm' && 'scale-95')}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="inline-flex size-10 items-center justify-center rounded-full text-lg font-semibold text-plum hover:bg-card disabled:opacity-30"
        aria-label={`One fewer ${label}`}
      >
        −
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          if (Number.isFinite(n)) onChange(clamp(n || min));
        }}
        onFocus={(e) => e.target.select()}
        aria-label={label}
        className="w-11 bg-transparent text-center font-semibold tabular text-cocoa focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="inline-flex size-10 items-center justify-center rounded-full text-lg font-semibold text-plum hover:bg-card disabled:opacity-30"
        aria-label={`One more ${label}`}
      >
        +
      </button>
    </div>
  );
}

/** Two- or three-way choice shown as a pill track (e.g. Pickup / Delivery). */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full bg-cream-deep p-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all [&_svg]:size-4',
              active ? 'bg-card text-plum shadow-soft' : 'text-cocoa-soft hover:text-plum'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
