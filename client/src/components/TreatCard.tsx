import { Link } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { productPath, startingPrice, type MenuItem } from '../lib/menu';
import { cn, formatMoney } from '../lib/utils';
import { TreatImage } from './ui/bits';

/** Menu card. The whole card is the link; the "+" is decorative emphasis. */
export function TreatCard({ item, className }: { item: MenuItem; className?: string }) {
  const { amount, from } = startingPrice(item);
  return (
    <Link
      to={productPath(item)}
      state={{ modal: true }}
      className={cn(
        'group relative flex flex-col rounded-lg bg-card p-2 shadow-soft ring-1 ring-crumb/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5',
        className
      )}
      aria-label={`${item.name}, ${from ? 'from ' : ''}${formatMoney(amount)}`}
    >
      <div className="relative overflow-hidden rounded-lg">
        <TreatImage src={item.image} alt="" section={item.section} className="aspect-[4/3] w-full transition duration-500 group-hover:scale-[1.04]" />
        {item.popular && (
          <span className="absolute left-0 top-3 inline-flex items-center gap-1 rounded-r-full bg-cherry py-1 pl-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-white shadow-soft">
            <Star className="size-3 fill-current" aria-hidden />
            Favourite
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-cocoa sm:text-lg">{item.name}</h3>
        {item.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-cocoa-soft sm:text-sm">{item.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="leading-tight">
            {from && <span className="block text-[11px] font-medium uppercase tracking-wide text-cocoa-faint">from</span>}
            <span className="tabular font-semibold text-plum">{formatMoney(amount)}</span>
            {item.minQuantity > 1 && <span className="block text-[11px] text-cocoa-faint">min {item.minQuantity}</span>}
          </p>
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-plum text-cream shadow-soft transition group-hover:bg-cherry group-active:scale-90"
            aria-hidden
          >
            <Plus className="size-5" strokeWidth={2.4} />
          </span>
        </div>
      </div>
    </Link>
  );
}
