import { lazy, Suspense, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { addDays, cn, dateKey, formatDateShort, fromKey } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const Calendar = lazy(() => import('./ui/calendar'));

const DAYS_SHOWN = 14;
const FURTHEST_DAYS = 180;

interface Props {
  id: string;
  minDate: string;
  value: string;
  onChange: (date: string) => void;
  invalid?: boolean;
}

/** A row of the next 14 bookable days, plus a calendar for anything later. */
export function DatePickerCards({ id, minDate, value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const today = dateKey();
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(minDate, i)), [minDate]);
  const maxDate = addDays(today, FURTHEST_DAYS);
  const outside = value && !days.includes(value);

  const card = (on: boolean) =>
    cn(
      'flex h-[88px] w-[68px] shrink-0 snap-start flex-col items-center justify-center rounded-lg border-2 transition active:scale-95',
      on ? 'border-plum bg-plum text-cream shadow-soft' : 'border-crumb bg-card text-cocoa hover:border-plum/40',
      invalid && !on && 'border-berry/40'
    );

  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none sm:mx-0 sm:px-0" role="radiogroup" aria-labelledby={`${id}-label`}>
      {days.map((d, i) => {
        const date = fromKey(d);
        const on = d === value;
        return (
          <button
            key={d}
            id={i === 0 ? id : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => onChange(d)}
            className={card(on)}
          >
            <span className={cn('text-[11px] font-semibold uppercase tracking-wider', on ? 'text-peach' : 'text-cocoa-faint')}>
              {d === today ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
            <span className="tabular font-display text-2xl font-semibold leading-tight">{date.getDate()}</span>
            <span className={cn('text-xs', on ? 'text-cream/80' : 'text-cocoa-soft')}>{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
          </button>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" role="radio" aria-checked={!!outside} className={cn(card(!!outside), 'w-[92px] gap-1 px-2 text-center')}>
            <CalendarDays className={cn('size-5', outside ? 'text-peach' : 'text-plum')} aria-hidden />
            <span className="text-xs font-semibold leading-tight">{outside ? formatDateShort(value) : 'Another date'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <Suspense fallback={<div className="h-[340px] w-[304px]" />}>
            <Calendar
              mode="single"
              selected={value ? fromKey(value) : undefined}
              defaultMonth={value ? fromKey(value) : fromKey(minDate)}
              startMonth={fromKey(minDate)}
              endMonth={fromKey(maxDate)}
              disabled={[{ before: fromKey(minDate) }, { after: fromKey(maxDate) }]}
              onSelect={(d) => {
                if (d) {
                  onChange(dateKey(d));
                  setOpen(false);
                }
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
    </div>
  );
}
