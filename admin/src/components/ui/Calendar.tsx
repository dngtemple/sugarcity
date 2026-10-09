import { useEffect, useRef, type ComponentProps } from 'react';
import { DayPicker, type ChevronProps, type DayButtonProps } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

function Chevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
  return <Icon className={cn('size-5', className)} aria-hidden />;
}

/** One look per day, strongest state first, so states never fight over colour. */
function DayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  return (
    <button
      ref={ref}
      data-day={day.isoDate}
      className={cn(
        className,
        modifiers.selected
          ? 'bg-plum font-semibold text-cream hover:bg-plum-700'
          : modifiers.disabled
            ? 'cursor-default text-cocoa-faint/40'
            : modifiers.outside
              ? 'text-cocoa-faint hover:bg-plum-50'
              : modifiers.today
                ? 'bg-peach-50 font-semibold text-plum ring-1 ring-inset ring-peach hover:bg-peach/40'
                : 'text-cocoa hover:bg-plum-50'
      )}
      {...props}
    />
  );
}

const nav =
  'inline-flex size-10 items-center justify-center rounded-full text-cocoa-soft hover:bg-plum-50 hover:text-plum aria-disabled:pointer-events-none aria-disabled:opacity-30';

export function Calendar({ classNames, components, ...props }: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      weekStartsOn={1}
      className="p-3"
      classNames={{
        months: 'relative',
        month: 'space-y-1',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: nav,
        button_next: nav,
        month_caption: 'flex h-10 items-center justify-center',
        caption_label: 'font-display text-base font-semibold text-plum',
        month_grid: 'border-collapse',
        weekday: 'size-10 p-0 text-xs font-semibold text-cocoa-faint',
        day: 'size-10 p-0 text-center',
        day_button: 'inline-flex size-10 items-center justify-center rounded-full text-[15px] tabular transition-colors',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{ Chevron, DayButton, ...components }}
      {...props}
    />
  );
}
