import { cn } from '../../lib/utils';
import { SECTION_INFO, type Section } from '../../lib/menu';

/** The WhatsApp glyph (lucide has none). */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('size-5', className)} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.39 9.39 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43 2.52 0 4.89.98 6.67 2.77a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.23 9.42-9.44 9.42m8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.08c0 2 .52 3.95 1.52 5.66L.62 23.25l5.64-1.48a11.3 11.3 0 0 0 5.78 1.48h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.32-8.01" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('size-5', className)} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Product photo, or a peach gradient with the collection's icon. */
export function TreatImage({ src, alt, section, className, iconClass }: { src?: string; alt: string; section: Section; className?: string; iconClass?: string }) {
  const Icon = SECTION_INFO[section].icon;
  if (src) return <img src={src} alt={alt} loading="lazy" decoding="async" className={cn('object-cover', className)} />;
  return (
    <div className={cn('flex items-center justify-center bg-gradient-to-br from-peach-50 via-peach/60 to-plum-100', className)} role="img" aria-label={alt}>
      <Icon className={cn('size-1/4 min-h-6 min-w-6 text-plum/45', iconClass)} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-cream-deep', className)} aria-hidden />;
}

export function Pill({ tone = 'plum', children, className }: { tone?: 'plum' | 'mint' | 'honey' | 'berry' | 'peach' | 'cherry'; children: React.ReactNode; className?: string }) {
  const tones = {
    plum: 'bg-plum-50 text-plum',
    mint: 'bg-mint-50 text-mint-700',
    honey: 'bg-honey-50 text-honey-700',
    berry: 'bg-berry-50 text-berry-700',
    peach: 'bg-peach-50 text-peach-700',
    cherry: 'bg-cherry text-white',
  } as const;
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function Logo({ className }: { className?: string }) {
  return <img src="/brand/sugarcity-logo.png" alt="Sugar City" width={150} height={150} className={cn('h-12 w-12 object-contain', className)} />;
}
