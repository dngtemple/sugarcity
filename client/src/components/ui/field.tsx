import * as React from 'react';
import { cn } from '../../lib/utils';

interface FieldProps {
  id: string;
  label: string;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  counter?: { value: number; max: number };
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ id, label, optional, hint, error, counter, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-cocoa">
          {label}
          {optional && <span className="ml-1.5 font-normal text-cocoa-faint">optional</span>}
        </label>
        {counter && (
          <span className={cn('tabular text-xs', counter.value >= counter.max ? 'text-cherry' : 'text-cocoa-faint')} aria-live="polite">
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-berry">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-cocoa-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  'w-full rounded-md border-2 border-crumb bg-card px-4 text-cocoa placeholder:text-cocoa-faint transition-colors hover:border-crumb-strong focus:border-plum focus:shadow-ring focus:outline-none aria-[invalid=true]:border-berry';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, 'h-12', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, 'min-h-[96px] resize-y py-3', className)} {...props} />
);
Textarea.displayName = 'Textarea';
