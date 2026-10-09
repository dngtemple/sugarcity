import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, X } from 'lucide-react';
import { cn, keepOpenForToasts } from '../../lib/utils';

export type OverlayKind = 'center' | 'right' | 'full';

const PANEL: Record<OverlayKind, string> = {
  // Bottom sheet on phones, a floating card from 640px up. Centred with
  // inset-0 + m-auto (not translate) so the zoom animation's transform can't undo it.
  center:
    'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl animate-rise sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[86dvh] sm:w-[min(520px,calc(100vw-32px))] sm:rounded-xl sm:animate-zoom',
  right: 'inset-0 animate-fade sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(520px,100vw)] sm:rounded-l-xl sm:animate-drawer-in',
  full: 'inset-0 animate-fade',
};

/**
 * One wrapper for every dialog in the Studio: a centred card, a right-hand
 * drawer, or a full-screen workspace. Title row, scrolling body, sticky footer.
 */
export function Overlay({
  open,
  onOpenChange,
  kind = 'center',
  title,
  description,
  onBack,
  headerExtra,
  footer,
  children,
  className,
  bodyClassName,
  width,
  guard,
  hideHeader,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: OverlayKind;
  title: ReactNode;
  description?: ReactNode;
  onBack?: () => void;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Tailwind width override for `center`/`right` on larger screens. */
  width?: string;
  /** Return true to stop an outside-click / Escape close (e.g. unsaved changes). */
  guard?: () => boolean;
  hideHeader?: boolean;
}) {
  const stop = (e: Event) => {
    keepOpenForToasts(e);
    if (!e.defaultPrevented && guard?.()) e.preventDefault();
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-plum-900/45 backdrop-blur-[2px] animate-fade" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onInteractOutside={stop}
          onEscapeKeyDown={(e) => {
            if (guard?.()) e.preventDefault();
          }}
          className={cn('fixed z-50 flex flex-col overflow-hidden bg-cream shadow-lift focus:outline-none', PANEL[kind], width, className)}
        >
          <div className={cn('flex min-h-16 shrink-0 items-center gap-1 border-b border-crumb bg-card px-3 sm:px-4', hideHeader && 'sr-only')}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex size-11 items-center justify-center rounded-full text-cocoa-soft hover:bg-plum-50 hover:text-plum"
                aria-label="Back"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <div className={cn('min-w-0 flex-1 py-2', !onBack && 'pl-2')}>
              <Dialog.Title className="truncate font-display text-xl font-semibold text-plum">{title}</Dialog.Title>
              {description && <Dialog.Description className="truncate text-sm text-cocoa-soft">{description}</Dialog.Description>}
            </div>
            {headerExtra}
            <Dialog.Close
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-cocoa-soft hover:bg-plum-50 hover:text-plum"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5', bodyClassName)}>{children}</div>
          {footer && <div className="shrink-0 border-t border-crumb bg-card px-4 pt-3 pb-safe sm:px-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
