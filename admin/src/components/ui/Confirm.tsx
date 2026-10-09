import type { ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

/** A yes/no question that has to be answered. Escape or "cancel" keeps things as they are. */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep it',
  tone = 'danger',
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'plain';
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-plum-900/50 animate-fade" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-lift animate-zoom focus:outline-none"
          onEscapeKeyDown={(e) => loading && e.preventDefault()}
        >
          <div className="flex gap-4">
            {tone === 'danger' && (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-berry-50 text-berry">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <AlertDialog.Title className="font-display text-xl font-semibold text-cocoa">{title}</AlertDialog.Title>
              {body ? (
                <AlertDialog.Description asChild>
                  <div className="mt-2 text-[15px] leading-relaxed text-cocoa-soft">{body}</div>
                </AlertDialog.Description>
              ) : (
                <AlertDialog.Description className="sr-only">Please confirm.</AlertDialog.Description>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              onClick={onConfirm}
              className={cn(tone === 'danger' && 'sm:min-w-32')}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** The standard "you have unsaved changes" question, wired to a router blocker. */
export function LeaveGuard({ blocker }: { blocker: { state: string; proceed?: () => void; reset?: () => void } }) {
  return (
    <Confirm
      open={blocker.state === 'blocked'}
      onOpenChange={(o) => !o && blocker.reset?.()}
      title="Leave without saving?"
      body="Your changes on this page haven’t been saved yet. If you leave now they’ll be lost."
      confirmLabel="Leave page"
      cancelLabel="Stay here"
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
