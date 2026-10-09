import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Label + control + hint/error, in one tidy block. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
  aside,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  /** Something on the right of the label row, e.g. a character count. */
  aside?: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="sc-label">
          {label}
          {optional && <span className="ml-1.5 text-xs font-normal text-cocoa-faint">optional</span>}
        </label>
        {aside && <span className="text-xs tabular text-cocoa-faint">{aside}</span>}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-berry" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-cocoa-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input className={cn('sc-input', className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Textarea({ className, invalid, ...props }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea className={cn('sc-input min-h-24 resize-y py-2.5 leading-relaxed', className)} aria-invalid={invalid || undefined} {...props} />;
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** A native select: keyboard, screen-reader and phone-picker friendly for free. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  invalid,
  ...props
}: Omit<ComponentProps<'select'>, 'onChange' | 'value'> & {
  value: T | '';
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <select
      className={cn('sc-select', !value && 'text-cocoa-faint', className)}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled} className="text-cocoa">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Search input with a magnifier, used across lists. */
export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-cocoa-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" className="sc-input rounded-full pl-10" {...props} />
    </div>
  );
}
