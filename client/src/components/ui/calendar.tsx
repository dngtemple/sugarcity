import * as React from 'react';
import { DayPicker, type ChevronProps, type DayButtonProps } from 'react-day-picker';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

function Chevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === 'left' ? ArrowLeft : ArrowRight;
  return <Icon className={cn('size-4', className)} aria-hidden />;
}

function DayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  let look = 'text-cocoa hover:bg-peach-50';
  if (modifiers.selected) look = 'bg-plum font-semibold text-cream';
  else if (modifiers.disabled) look = 'cursor-default text-cocoa-faint/40 line-through decoration-crumb-strong';
  else if (modifiers.outside) look = 'text-cocoa-faint hover:bg-peach-50';
  else if (modifiers.today) look = 'font-semibold text-cherry ring-1 ring-inset ring-cherry/30 hover:bg-cherry-50';

  return <button ref={ref} data-day={day.isoDate} className={cn(className, look)} {...props} />;
}

/** Month view in Sugar City colours (react-day-picker v9). Default export so it can be lazy-loaded. */
export default function Calendar(props: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      weekStartsOn={1}
      className="p-3"
      classNames={{
        months: 'relative',
        month: 'space-y-2',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous:
          'flex size-10 items-center justify-center rounded-full bg-cream-deep text-plum hover:bg-plum-100 aria-disabled:opacity-30 aria-disabled:pointer-events-none',
        button_next:
          'flex size-10 items-center justify-center rounded-full bg-cream-deep text-plum hover:bg-plum-100 aria-disabled:opacity-30 aria-disabled:pointer-events-none',
        month_caption: 'flex h-10 items-center justify-center',
        caption_label: 'font-display text-lg font-semibold text-plum',
        month_grid: 'border-collapse',
        weekday: 'size-10 p-0 text-[11px] font-semibold uppercase tracking-wide text-cocoa-faint',
        day: 'size-10 p-0 text-center',
        day_button: 'tabular flex size-10 items-center justify-center rounded-full text-[15px] transition-colors',
        hidden: 'invisible',
      }}
      components={{ Chevron, DayButton }}
      {...props}
    />
  );
}
