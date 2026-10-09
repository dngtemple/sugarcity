import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, PlusSquare, Share } from 'lucide-react';
import { promptInstall, useInstall } from '../../lib/install';
import { cn } from '../../lib/utils';
import { Overlay } from '../ui/Overlay';
import { Button } from '../ui/Button';

/**
 * "Install app": the browser's prompt where there is one, or a short
 * Add-to-Home-Screen guide on iPhone and iPad. Hidden once installed.
 */
export function InstallButton({ compact, onDark, className }: { compact?: boolean; onDark?: boolean; className?: string }) {
  const { available, canPrompt, ios } = useInstall();
  const [helpOpen, setHelpOpen] = useState(false);
  if (!available) return null;

  const install = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (ok) toast.success('Sugar City Studio is on your home screen');
    } else if (ios) {
      setHelpOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        title={compact ? 'Install app' : undefined}
        aria-label={compact ? 'Install app' : undefined}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-full text-sm font-semibold transition-colors',
          compact ? 'w-11 justify-center' : 'px-4',
          onDark ? 'text-peach hover:bg-white/10' : 'text-plum hover:bg-plum-50',
          className
        )}
      >
        <Download className="size-5 shrink-0" aria-hidden />
        {!compact && 'Install app'}
      </button>
      <IosInstallHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

function IosInstallHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = [
    { icon: <Share className="size-5" />, text: <>Tap the <strong>Share</strong> button in Safari’s toolbar.</> },
    { icon: <PlusSquare className="size-5" />, text: <>Scroll down and choose <strong>Add to Home Screen</strong>.</> },
    { icon: <span className="font-display text-base font-bold">✓</span>, text: <>Tap <strong>Add</strong>. The Studio opens full-screen from its own icon.</> },
  ];
  return (
    <Overlay
      open={open}
      onOpenChange={onOpenChange}
      title="Add the Studio to your home screen"
      footer={
        <Button block onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      }
    >
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach-50 text-plum">{s.icon}</span>
            <span className="text-[15px] text-cocoa">{s.text}</span>
          </li>
        ))}
      </ol>
    </Overlay>
  );
}
