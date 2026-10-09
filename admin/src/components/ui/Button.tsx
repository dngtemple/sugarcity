import type { ComponentProps, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, cn(block && 'w-full', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** A round, icon-only button with a 44px tap target. `label` is read out. */
export function IconButton({
  label,
  className,
  children,
  tone = 'plain',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label: string; tone?: 'plain' | 'onDark' | 'danger'; children: ReactNode }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-5',
        tone === 'onDark' && 'text-cream/80 hover:bg-white/10 hover:text-cream',
        tone === 'plain' && 'text-cocoa-soft hover:bg-plum-50 hover:text-plum',
        tone === 'danger' && 'text-cocoa-faint hover:bg-berry-50 hover:text-berry',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
