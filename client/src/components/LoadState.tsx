import { CloudOff, RefreshCw } from 'lucide-react';
import { useMenu, useSettings } from '../stores/menuStore';
import { whatsappLink } from '../lib/whatsapp';
import { Button } from './ui/button';
import { buttonStyles } from './ui/button-styles';
import { WhatsAppIcon } from './ui/bits';

/** Friendly "couldn't load" card with a retry and a WhatsApp way out. */
export function MenuError({ title = 'The menu didn’t come through', body = 'It might be your connection, or our oven taking a nap. Give it another go.' }: { title?: string; body?: string }) {
  const load = useMenu((s) => s.load);
  const settings = useSettings();
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl bg-card p-8 text-center shadow-soft ring-1 ring-crumb">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-peach-50 text-plum">
        <CloudOff className="size-7" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold text-plum">{title}</h2>
      <p className="mt-1 text-cocoa-soft">{body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button onClick={load}>
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
        <a
          href={whatsappLink(settings.whatsappNumber, 'Hi Sugar City! I’d like to place an order.')}
          target="_blank"
          rel="noreferrer"
          className={buttonStyles({ variant: 'outline' })}
        >
          <WhatsAppIcon className="size-4" />
          Order on WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Shown under skeletons when the server is slow to wake. */
export function SlowNote() {
  const slow = useMenu((s) => s.slow);
  if (!slow) return null;
  return (
    <p role="status" className="mt-6 text-center text-sm text-cocoa-soft">
      Warming up the ovens… the first visit can take up to a minute.
    </p>
  );
}
