import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Show a bin instead of "−" at the minimum, and allow going below it. */
  removable?: boolean;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pill-shaped − n + control. */
export function Stepper({ value, min = 1, max = 1000, onChange, removable, label, size = 'md', className }: StepperProps) {
  const atMin = value <= min;
  const btn = cn(
    'flex shrink-0 items-center justify-center rounded-full text-plum transition hover:bg-plum-100 active:scale-90 disabled:opacity-30',
    size === 'sm' ? 'size-9' : 'size-11'
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center rounded-full bg-plum-50 p-0.5', size === 'sm' ? 'min-h-10' : 'min-h-12', className)}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={atMin && !removable}
        aria-label={atMin && removable ? 'Remove' : 'One less'}
      >
        {atMin && removable ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <input
        inputMode="numeric"
        aria-label="Quantity"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        onFocus={(e) => e.target.select()}
        className={cn(
          'tabular w-10 bg-transparent text-center font-semibold text-cocoa focus:outline-none',
          size === 'sm' ? '!text-[15px]' : '!text-base'
        )}
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="One more">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
