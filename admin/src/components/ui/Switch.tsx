import type { ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  className,
  size = 'md',
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Read out when there is no visible <label for>. */
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // The visible track is small; the padding makes a 44px tap target.
        'group relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-2.5 -m-2.5 disabled:cursor-not-allowed disabled:opacity-45',
        className
      )}
    >
      <span
        className={cn(
          'flex items-center rounded-full transition-colors duration-200',
          size === 'md' ? 'h-7 w-12' : 'h-6 w-10',
          checked ? 'bg-mint' : 'bg-crumb-strong',
          'group-focus-visible:shadow-ring'
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block rounded-full bg-white shadow-soft transition-transform duration-200',
            size === 'md' ? 'size-6 translate-x-0.5 data-[state=checked]:translate-x-[22px]' : 'size-5 translate-x-0.5 data-[state=checked]:translate-x-[18px]'
          )}
        />
      </span>
    </SwitchPrimitive.Root>
  );
}

/** A setting with a title, an explanation and a switch on the right. */
export function SwitchRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum-50 text-plum [&_svg]:size-5">{icon}</span>}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-semibold text-cocoa">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-cocoa-soft">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
