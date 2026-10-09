import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Cake, Cookie, Gift, ShoppingBag, X } from 'lucide-react';
import { bagCount, bagTotal, useBag, type BagLine } from '../stores/bagStore';
import { formatMoney } from '../lib/utils';
import { Button } from './ui/button';
import { Stepper } from './ui/stepper';
import { TreatImage } from './ui/bits';

function optionText(line: BagLine) {
  return line.options.map((o) => o.name).join(' · ');
}

function Line({ line }: { line: BagLine }) {
  const setQuantity = useBag((s) => s.setQuantity);
  return (
    <li className="flex gap-3 py-4">
      <TreatImage src={line.image} alt="" section={line.section} className="size-20 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug text-cocoa">{line.name}</p>
          <p className="tabular shrink-0 font-semibold text-plum">{formatMoney(line.unitPrice * line.quantity)}</p>
        </div>
        {line.options.length > 0 && <p className="mt-0.5 text-sm text-cocoa-soft">{optionText(line)}</p>}
        {line.message && <p className="mt-0.5 text-sm italic text-cocoa-soft">“{line.message}”</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Stepper
            size="sm"
            removable
            value={line.quantity}
            min={line.minQuantity}
            onChange={(q) => setQuantity(line.key, q)}
            label={`Quantity of ${line.name}`}
          />
          <span className="text-xs text-cocoa-faint">
            {formatMoney(line.unitPrice)} each{line.minQuantity > 1 ? ` · min ${line.minQuantity}` : ''}
          </span>
        </div>
      </div>
    </li>
  );
}

function EmptyBag({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-6 size-40" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-peach-50" />
        <span className="absolute left-4 top-6 size-20 rounded-full bg-plum-100/70 blur-[2px]" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-20 items-center justify-center rounded-lg bg-card shadow-soft">
            <ShoppingBag className="size-9 text-plum" strokeWidth={1.6} />
          </span>
        </span>
        <span className="absolute -left-1 top-3 flex size-11 rotate-[-12deg] items-center justify-center rounded-full bg-card shadow-soft">
          <Cake className="size-5 text-cherry" />
        </span>
        <span className="absolute -right-1 top-10 flex size-10 rotate-12 items-center justify-center rounded-full bg-card shadow-soft">
          <Cookie className="size-5 text-peach-700" />
        </span>
        <span className="absolute bottom-1 right-8 flex size-9 items-center justify-center rounded-full bg-card shadow-soft">
          <Gift className="size-4 text-plum" />
        </span>
      </div>
      <p className="font-display text-2xl font-semibold text-plum">Your bag is empty</p>
      <p className="mt-1 max-w-[16rem] text-cocoa-soft">Something sweet is just a few taps away.</p>
      <Button className="mt-6" onClick={onBrowse}>
        Browse the menu
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function BagDrawer() {
  const navigate = useNavigate();
  const { lines, open, setOpen, notice, dismissNotice } = useBag();
  const count = bagCount(lines);
  const total = bagTotal(lines);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-plum-900/40 backdrop-blur-[2px] animate-fade" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-cream shadow-lift animate-drawer-in focus:outline-none sm:max-w-md sm:rounded-l-xl"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-crumb px-5 py-3">
            <Dialog.Title className="font-display text-2xl font-semibold text-plum">
              Your bag
              {count > 0 && <span className="tabular ml-2 align-middle font-sans text-sm font-medium text-cocoa-faint">{count} {count === 1 ? 'treat' : 'treats'}</span>}
            </Dialog.Title>
            <Dialog.Close className="flex size-11 items-center justify-center rounded-full bg-card text-cocoa shadow-soft hover:bg-cream-deep" aria-label="Close bag">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          {notice && (
            <div role="status" className="mx-5 mt-4 flex gap-3 rounded-md bg-honey-50 p-3 text-sm text-honey-700 ring-1 ring-honey-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="flex-1 space-y-1">
                {notice.removed.length > 0 && <p>No longer on the menu, so we took it out: {notice.removed.join(', ')}.</p>}
                {notice.repriced.length > 0 && <p>New price since you added it: {notice.repriced.join(', ')}.</p>}
              </div>
              <button type="button" onClick={dismissNotice} className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-honey-200/50" aria-label="Dismiss">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )}

          {lines.length === 0 ? (
            <EmptyBag onBrowse={() => go('/menu')} />
          ) : (
            <>
              <ul className="flex-1 divide-y divide-crumb overflow-y-auto px-5">
                {lines.map((line) => (
                  <Line key={line.key} line={line} />
                ))}
              </ul>
              <div className="border-t border-crumb bg-card px-5 pt-4 pb-safe">
                <div className="flex items-baseline justify-between">
                  <span className="text-cocoa-soft">Subtotal</span>
                  <span className="tabular font-display text-2xl font-semibold text-cocoa">{formatMoney(total)}</span>
                </div>
                <p className="mt-1 text-sm text-cocoa-faint">Delivery, if you need it, is agreed with you on WhatsApp.</p>
                <Button block size="lg" className="mt-4" onClick={() => go('/checkout')}>
                  Checkout
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
