import { Suspense, lazy, useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, X } from 'lucide-react';
import { cn, dateKey, formatDay, fromKey } from '../../lib/utils';

// The calendar library is fetched once a picker appears, not on first load.
const loadCalendar = () => import('./Calendar');
const Calendar = lazy(() => loadCalendar().then((m) => ({ default: m.Calendar })));

/** A field that opens a month calendar. Values are YYYY-MM-DD strings. */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  clearable,
  invalid,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromKey(value) : undefined;
  const minDate = min ? fromKey(min) : undefined;
  const maxDate = max ? fromKey(max) : undefined;
  const disabled = [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])];

  useEffect(() => {
    void loadCalendar();
  }, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            aria-invalid={invalid || undefined}
            className={cn('sc-input flex items-center gap-2.5 text-left', !value && 'text-cocoa-faint', clearable && value && 'pr-11')}
          >
            <CalendarDays className="size-[18px] shrink-0 text-plum" aria-hidden />
            <span className="truncate">{value ? `${formatDay(value)}${['Today', 'Tomorrow', 'Yesterday'].includes(formatDay(value)) ? ` · ${fromKey(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}` : placeholder}</span>
          </button>
        </Popover.Trigger>
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-full text-cocoa-faint hover:text-plum"
            aria-label="Clear date"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[80] rounded-xl border border-crumb bg-card shadow-lift animate-zoom focus:outline-none"
        >
          <Suspense fallback={<div className="h-[340px] w-[304px]" aria-busy />}>
            <Calendar
              mode="single"
              required
              autoFocus
              selected={selected}
              defaultMonth={selected ?? minDate ?? fromKey(dateKey())}
              startMonth={minDate}
              endMonth={maxDate}
              disabled={disabled.length ? disabled : undefined}
              onSelect={(d: Date) => {
                onChange(dateKey(d));
                setOpen(false);
              }}
            />
          </Suspense>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
