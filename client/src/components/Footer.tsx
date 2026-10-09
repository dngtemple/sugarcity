import { MapPin, Phone, Wallet } from 'lucide-react';
import { useSettings } from '../stores/menuStore';
import { whatsappLink } from '../lib/whatsapp';
import { InstallCard } from './InstallApp';
import { InstagramIcon, Logo, WhatsAppIcon } from './ui/bits';

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-peach">{title}</h2>
      <div className="space-y-2 text-[15px] text-cream/85">{children}</div>
    </div>
  );
}

const link = 'inline-flex min-h-11 items-center gap-2.5 rounded-md hover:text-white hover:underline underline-offset-4';

export function Footer() {
  const s = useSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-plum-900 pb-32 text-cream md:pb-10">
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr] lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
          <div className="space-y-4">
            <span className="inline-flex rounded-xl bg-white p-2 shadow-soft">
              <Logo className="h-16 w-16" />
            </span>
            <p className="max-w-xs font-display text-xl leading-snug text-cream">Baked for your sweetest moments.</p>
          </div>

          <Column title="Visit us">
            <p className="flex gap-2.5">
              <MapPin className="mt-0.5 size-5 shrink-0 text-peach" aria-hidden />
              <span>{s.pickupAddress || 'Pickup details are shared when you order.'}</span>
            </p>
          </Column>

          <Column title="Talk to us">
            {s.phone && (
              <a href={`tel:${s.phone.replace(/\s/g, '')}`} className={link}>
                <Phone className="size-5 text-peach" aria-hidden />
                {s.phone}
              </a>
            )}
            <a href={whatsappLink(s.whatsappNumber)} target="_blank" rel="noreferrer" className={link}>
              <WhatsAppIcon className="text-peach" />
              Chat on WhatsApp
            </a>
            {s.instagram && (
              <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noreferrer" className={link}>
                <InstagramIcon className="text-peach" />@{s.instagram}
              </a>
            )}
          </Column>

          <div className="space-y-8">
            <Column title="Paying">
              <p className="flex gap-2.5">
                <Wallet className="mt-0.5 size-5 shrink-0 text-peach" aria-hidden />
                <span className="whitespace-pre-line">{s.paymentInstructions || 'We’ll send payment details with your order confirmation.'}</span>
              </p>
            </Column>
          </div>
        </div>

        <div className="mt-10 max-w-md">
          <InstallCard />
        </div>

        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-cream/60">© {year} Sugar City. Made with butter and love.</p>
      </div>
    </footer>
  );
}
