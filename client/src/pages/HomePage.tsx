import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarClock, PackageSearch, ShoppingBag } from 'lucide-react';
import { useMenu } from '../stores/menuStore';
import { SECTIONS, SECTION_INFO, type MenuItem, type Section } from '../lib/menu';
import { buttonStyles } from '../components/ui/button-styles';
import { Logo, Skeleton, WhatsAppIcon } from '../components/ui/bits';
import { TreatCard } from '../components/TreatCard';
import { MenuError, SlowNote } from '../components/LoadState';
import { cn } from '../lib/utils';

function coverFor(items: MenuItem[], section: Section) {
  const inSection = items.filter((i) => i.section === section && i.image);
  return (inSection.find((i) => i.popular) ?? inSection[0])?.image;
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-sprinkles absolute inset-0 opacity-70" aria-hidden />
      <div className="absolute -left-24 -top-24 size-72 rounded-full bg-peach/60 blur-3xl" aria-hidden />
      <div className="absolute -bottom-32 right-[-6rem] size-96 rounded-full bg-plum-200/60 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 md:grid-cols-[1.25fr_1fr] md:pb-20 md:pt-16">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cherry shadow-soft ring-1 ring-crumb">
            <span className="size-1.5 rounded-full bg-cherry" aria-hidden />
            Fresh from the Sugar City oven
          </p>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-plum sm:text-6xl lg:text-7xl">
            Baked for your <em className="font-medium italic text-cherry">sweetest</em> moments.
          </h1>
          <p className="mt-5 max-w-md text-lg text-cocoa-soft">
            Cakes, pastries and gift boxes made to order. Pick your treats, choose a day, and we’ll take it from there.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/menu" className={buttonStyles({ size: 'lg' })}>
              Browse the menu
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link to="/track" className={buttonStyles({ variant: 'outline', size: 'lg' })}>
              <PackageSearch className="size-5" aria-hidden />
              Track an order
            </Link>
          </div>
        </div>

        <div className="relative hidden justify-center md:flex" aria-hidden>
          <div className="absolute size-80 rounded-full border-2 border-dashed border-plum/15 lg:size-96" />
          <div className="relative flex size-64 items-center justify-center rounded-full bg-white shadow-lift lg:size-80">
            <Logo className="h-44 w-44 lg:h-56 lg:w-56" />
          </div>
          <span className="absolute right-6 top-4 size-8 rounded-full bg-cherry shadow-soft" />
          <span className="absolute bottom-8 left-6 size-12 rounded-full bg-peach shadow-soft" />
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ id, eyebrow, title, action }: { id: string; eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cherry">{eyebrow}</p>
        <h2 id={id} className="mt-1 font-display text-3xl font-semibold tracking-tight text-plum sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function CollectionTiles({ items, loading }: { items: MenuItem[]; loading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SECTIONS.map((section, i) => {
        const info = SECTION_INFO[section];
        const Icon = info.icon;
        const cover = coverFor(items, section);
        return (
          <Link
            key={section}
            to={`/menu/${section}`}
            className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-xl shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:h-80 animate-rise"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {loading ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : cover ? (
              <img src={cover} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
            ) : (
              <div
                className={cn(
                  'absolute inset-0 flex items-start justify-end p-6',
                  i === 0 && 'bg-gradient-to-br from-peach via-peach-50 to-plum-100',
                  i === 1 && 'bg-gradient-to-br from-plum-100 via-peach-50 to-peach',
                  i === 2 && 'bg-gradient-to-br from-cherry-50 via-plum-50 to-plum-200'
                )}
              >
                <Icon className="size-24 text-plum/25" strokeWidth={1.25} aria-hidden />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-plum-900/85 via-plum-900/25 to-transparent" aria-hidden />
            <div className="relative flex items-end justify-between gap-3 p-5 text-cream">
              <div>
                <span className="mb-2 inline-flex size-10 items-center justify-center rounded-full bg-cream/90 text-plum">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-display text-2xl font-semibold">{info.label}</h3>
                <p className="mt-1 text-sm text-cream/85">{info.blurb}</p>
              </div>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach text-plum-900 transition group-hover:rotate-45" aria-hidden>
                <ArrowUpRight className="size-5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Favourites({ items }: { items: MenuItem[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:-mx-6 sm:px-6" role="list">
      {items.map((item) => (
        <div key={item._id} role="listitem" className="w-[70%] max-w-[260px] shrink-0 snap-start sm:w-64">
          <TreatCard item={item} className="h-full" />
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  { icon: ShoppingBag, title: 'Choose your treats', body: 'Pick from the menu, add your flavours and a message if you like.' },
  { icon: CalendarClock, title: 'Pick a day & time', body: 'Collect from us or have it delivered, whenever suits you.' },
  { icon: WhatsAppIcon, title: 'Confirm on WhatsApp', body: 'Send your order in one tap and we’ll confirm the details.' },
];

export default function HomePage() {
  const { status, items } = useMenu();
  const loading = status === 'loading' || status === 'idle';

  const favourites = useMemo(() => {
    const popular = items.filter((i) => i.popular);
    return (popular.length ? popular : items.filter((i) => i.image)).slice(0, 10);
  }, [items]);

  return (
    <>
      <Hero />

      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
        <section aria-labelledby="collections">
          <SectionHeading id="collections" eyebrow="Our collections" title="Shop by collection" />
          {status === 'error' && items.length === 0 ? null : <CollectionTiles items={items} loading={loading} />}
        </section>

        {status === 'error' && items.length === 0 ? (
          <MenuError />
        ) : (
          (loading || favourites.length > 0) && (
            <section aria-labelledby="favourites">
              <SectionHeading
                id="favourites"
                eyebrow="Loved by Sugar City"
                title="Customer favourites"
                action={
                  <Link to="/menu" className="hidden items-center gap-1 rounded-full px-3 py-2 font-semibold text-plum hover:bg-plum-50 sm:inline-flex">
                    See everything <ArrowRight className="size-4" aria-hidden />
                  </Link>
                }
              />
              {loading ? (
                <div className="flex gap-4 overflow-hidden" aria-label="Loading favourites">
                  {[0, 1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-80 w-64 shrink-0 rounded-lg" />
                  ))}
                </div>
              ) : (
                <Favourites items={favourites} />
              )}
              <SlowNote />
            </section>
          )
        )}

        <section aria-labelledby="how">
          <SectionHeading id="how" eyebrow="Easy as pie" title="How it works" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative overflow-hidden rounded-xl bg-card p-6 shadow-soft ring-1 ring-crumb/60">
                <span className="tabular absolute -right-2 -top-6 font-display text-[7rem] font-bold leading-none text-peach-50" aria-hidden>
                  {i + 1}
                </span>
                <div className="relative">
                  <span className="flex size-12 items-center justify-center rounded-full bg-plum text-cream">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-plum">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-1 text-cocoa-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
