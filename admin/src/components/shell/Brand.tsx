import { cn } from '../../lib/utils';

/** The Sugar City logo on a white rounded badge — it's plum on white, so it needs one on dark plum. */
export function LogoBadge({ size = 44, round, className }: { size?: number; round?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-soft', round ? 'rounded-full' : 'rounded-md', className)}
      style={{ width: size, height: size }}
    >
      <img src="/brand/sugarcity-logo.png" alt="Sugar City" width={size} height={size} className="size-[88%] object-contain" />
    </span>
  );
}

/** Full-screen "Opening the Studio…" shown while the session is checked. */
export function StudioLoader({ label = 'Opening the Studio…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-plum-900 bg-sprinkles px-6 text-cream" role="status" aria-live="polite">
      <span className="animate-wobble">
        <LogoBadge size={88} round className="ring-8 ring-white/10" />
      </span>
      <p className="font-display text-xl font-medium">{label}</p>
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-pulse rounded-full bg-peach" style={{ animationDelay: `${i * 180}ms` }} />
        ))}
      </span>
    </div>
  );
}
