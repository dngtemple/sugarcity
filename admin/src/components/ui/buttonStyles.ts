import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'cherry' | 'soft' | 'outline' | 'ghost' | 'danger' | 'peach';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-plum text-cream shadow-soft hover:bg-plum-700 active:bg-plum-900',
  cherry: 'bg-cherry text-white shadow-soft hover:bg-cherry-700',
  peach: 'bg-peach text-plum-900 hover:bg-peach/80',
  soft: 'bg-plum-50 text-plum hover:bg-plum-100',
  outline: 'border border-crumb-strong bg-card text-cocoa hover:border-plum-200 hover:bg-plum-50',
  ghost: 'text-cocoa-soft hover:bg-plum-50 hover:text-plum',
  danger: 'bg-berry text-white shadow-soft hover:bg-berry-700',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 gap-1.5 px-4 text-sm [&_svg]:size-4',
  md: 'min-h-11 gap-2 px-5 text-[15px] [&_svg]:size-[18px]',
  lg: 'min-h-[52px] gap-2 px-6 text-base [&_svg]:size-5',
};

/** Class string for anything that should look like a button (e.g. a Link). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
    VARIANTS[variant],
    SIZES[size],
    extra
  );
}
