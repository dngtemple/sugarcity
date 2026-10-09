import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, SquarePlus, Share, Smartphone, X } from 'lucide-react';
import { promptInstall, useInstall } from '../lib/install';
import { Button } from './ui/button';

/** Footer card offering the home-screen app. Hidden once installed or where it isn't possible. */
export function InstallCard() {
  const { available, canPrompt, ios } = useInstall();
  const [help, setHelp] = useState(false);
  if (!available) return null;

  return (
    <div className="rounded-xl bg-white/[0.07] p-5 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach text-plum-900">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-cream">Install the Sugar City app</p>
          <p className="mt-0.5 text-sm text-cream/70">One tap to the menu and your orders, right from your home screen.</p>
        </div>
      </div>
      <Button
        variant="cherry"
        size="sm"
        className="mt-4"
        onClick={() => {
          if (canPrompt) void promptInstall();
          else if (ios) setHelp(true);
        }}
      >
        <Download className="size-4" aria-hidden />
        Install
      </Button>
      <IosInstallHelp open={help} onOpenChange={setHelp} />
    </div>
  );
}

function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = [
    { icon: Share, text: <>Tap the <strong>Share</strong> button in Safari’s toolbar.</> },
    { icon: SquarePlus, text: <>Scroll down and choose <strong>Add to Home Screen</strong>.</> },
    { icon: Download, text: <>Tap <strong>Add</strong>. Sugar City lands next to your other apps.</> },
  ];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-plum-900/50 backdrop-blur-sm animate-fade" />
        <Dialog.Content className="fixed inset-0 z-[70] m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-xl bg-card p-6 text-cocoa shadow-lift animate-zoom focus:outline-none">
          <Dialog.Close className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-cocoa-soft hover:bg-cream-deep" aria-label="Close">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
          <Dialog.Title className="pr-10 font-display text-2xl font-semibold text-plum">Add to your home screen</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-cocoa-soft">Three quick taps on your iPhone or iPad.</Dialog.Description>
          <ol className="mt-5 space-y-4">
            {steps.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peach-50 text-plum">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="pt-2 text-[15px]">{text}</p>
              </li>
            ))}
          </ol>
          <Dialog.Close asChild>
            <Button block className="mt-6">
              Got it
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
