import { Gift, Heart, MessageSquareText } from 'lucide-react';
import { COLLECTION_INFO, optionPriceLabel, ruleShort, startingPrice, type Collection, type OptionGroup } from '../../lib/menu';
import { formatMoney } from '../../lib/utils';
import { Pill } from '../ui/Bits';
import { OptionTile } from '../orders/OptionChooser';

/** How the item will look to customers: the menu card, then the choices sheet. */
export function ProductPreview({
  name,
  description,
  price,
  image,
  section,
  popular,
  allowMessage,
  isGift,
  minQuantity,
  groups,
  hidden,
}: {
  name: string;
  description: string;
  price: number;
  image?: string | null;
  section: Collection;
  popular: boolean;
  allowMessage: boolean;
  isGift: boolean;
  minQuantity: number;
  groups: OptionGroup[];
  hidden: boolean;
}) {
  const info = COLLECTION_INFO[section];
  const asItem = { price, optionGroups: groups };
  const start = startingPrice(asItem);
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-crumb bg-card shadow-soft">
        {hidden && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-cocoa/80 px-2.5 py-1 text-xs font-semibold text-cream">Hidden from the website</span>
        )}
        <div className="aspect-[4/3] bg-peach-50">
          {image ? (
            <img src={image} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-peach-700">
              <info.icon className="size-12" aria-hidden />
            </div>
          )}
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex flex-wrap gap-1.5">
            {popular && (
              <Pill tone="cherry">
                <Heart className="fill-current" /> Favourite
              </Pill>
            )}
            {isGift && (
              <Pill tone="peach">
                <Gift /> Gift
              </Pill>
            )}
          </div>
          <p className="font-display text-xl font-semibold text-cocoa">{name.trim() || `Your ${info.noun}`}</p>
          {description.trim() && <p className="line-clamp-2 text-sm text-cocoa-soft">{description}</p>}
          <div className="flex items-center justify-between pt-1">
            <p className="font-semibold tabular text-plum">
              {start.from && <span className="font-normal text-cocoa-faint">From </span>}
              {formatMoney(start.amount)}
              {minQuantity > 1 && <span className="ml-1 text-xs font-normal text-cocoa-faint">each · min {minQuantity}</span>}
            </p>
            <span className="rounded-full bg-plum px-4 py-1.5 text-sm font-semibold text-cream">Add</span>
          </div>
        </div>
      </div>

      {(groups.some((g) => g.options.length > 0) || allowMessage) && (
        <div className="space-y-4 rounded-xl border border-crumb bg-card p-4">
          <p className="sc-eyebrow">Choices sheet</p>
          {groups
            .filter((g) => g.options.length > 0)
            .map((g, gi) => (
              <div key={gi}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="font-display font-semibold text-cocoa">{g.name || 'Untitled group'}</p>
                  <Pill tone={g.required ? 'plum' : 'neutral'}>{ruleShort(g)}</Pill>
                </div>
                <div className="grid gap-2">
                  {g.options.slice(0, 4).map((o, oi) => (
                    <OptionTile
                      key={oi}
                      readOnly
                      multiple={g.multiple}
                      checked={oi === 0 && g.required}
                      name={o.name}
                      price={optionPriceLabel(asItem, groups.indexOf(g), o, formatMoney)}
                    />
                  ))}
                  {g.options.length > 4 && <p className="text-xs text-cocoa-faint">+ {g.options.length - 4} more</p>}
                </div>
              </div>
            ))}
          {allowMessage && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-cocoa">
                <MessageSquareText className="size-4 text-plum" aria-hidden /> Message on the cake/box
              </p>
              <div className="sc-input text-cocoa-faint">e.g. Happy birthday, Ama!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
