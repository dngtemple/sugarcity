import { Cake, Cookie, Gift, type LucideIcon } from 'lucide-react';

/* Mirrors the server's menu model and pricing rules. */

export interface MenuOption {
  _id?: string;
  name: string;
  price: number;
}

export interface OptionGroup {
  _id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: MenuOption[];
}

export const COLLECTIONS = ['cakes', 'pastries', 'gifts'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const isCollection = (v: unknown): v is Collection => COLLECTIONS.includes(v as Collection);

export interface CollectionInfo {
  label: string;
  short: string;
  blurb: string;
  icon: LucideIcon;
  noun: string;
  namePlaceholder: string;
  categoryPlaceholder: string;
  descriptionPlaceholder: string;
}

export const COLLECTION_INFO: Record<Collection, CollectionInfo> = {
  cakes: {
    label: 'Cakes',
    short: 'Cakes',
    blurb: 'Birthdays, weddings and every celebration in between',
    icon: Cake,
    noun: 'cake',
    namePlaceholder: 'e.g. Red Velvet Celebration Cake',
    categoryPlaceholder: 'e.g. Birthday Cakes',
    descriptionPlaceholder: 'e.g. Three soft layers with cream-cheese frosting.',
  },
  pastries: {
    label: 'Pastries & Treats',
    short: 'Pastries',
    blurb: 'Cupcakes, doughnuts, cookies, pies and party trays',
    icon: Cookie,
    noun: 'treat',
    namePlaceholder: 'e.g. Glazed Doughnuts',
    categoryPlaceholder: 'e.g. Doughnuts',
    descriptionPlaceholder: 'e.g. Pillowy doughnuts dipped in vanilla glaze. Price per box.',
  },
  gifts: {
    label: 'Gift Boxes',
    short: 'Gifts',
    blurb: 'Sweet surprises delivered to someone special',
    icon: Gift,
    noun: 'gift box',
    namePlaceholder: 'e.g. Sweetheart Treat Box',
    categoryPlaceholder: 'e.g. Celebration Boxes',
    descriptionPlaceholder: 'e.g. Six cupcakes, a mini cake and a handwritten card.',
  },
};

export const collectionLabel = (c?: string) =>
  c && isCollection(c) ? COLLECTION_INFO[c].label : c === 'other' ? 'Other' : 'Cakes';

export interface MenuItem {
  _id: string;
  section: Collection;
  category: string;
  name: string;
  description?: string;
  price: number;
  available: boolean;
  popular?: boolean;
  allowMessage?: boolean;
  minQuantity: number;
  isGift: boolean;
  image?: string;
  optionGroups?: OptionGroup[];
  createdAt?: string;
  updatedAt?: string;
}

export type Selection = Record<string, string[]>;

const groupsOf = (item: Pick<MenuItem, 'optionGroups'>) => item.optionGroups ?? [];

/** The lowest price a customer can pay, and whether choices can raise it ("From"). */
export function startingPrice(item: Pick<MenuItem, 'price' | 'optionGroups'>) {
  let amount = Number(item.price) || 0;
  let from = false;
  for (const group of groupsOf(item)) {
    const prices = group.options.map((o) => Number(o.price) || 0);
    if (prices.length === 0) continue;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (group.required) amount += min;
    if (max > (group.required ? min : 0)) from = true;
  }
  return { amount, from };
}

export function chosenOptions(item: MenuItem, selection: Selection) {
  return groupsOf(item).flatMap((group) =>
    group.options
      .filter((o) => selection[group._id!]?.includes(o._id!))
      .map((o) => ({ groupId: group._id!, group: group.name, optionId: o._id!, name: o.name, price: Number(o.price) || 0 }))
  );
}

export function unitPrice(item: MenuItem, selection: Selection) {
  return (Number(item.price) || 0) + chosenOptions(item, selection).reduce((sum, o) => sum + o.price, 0);
}

export function missingGroups(item: MenuItem, selection: Selection) {
  return groupsOf(item).filter((g) => g.required && !selection[g._id!]?.length);
}

/** The group whose option prices *are* the price (base 0 + a required single choice). */
export function priceGroupIndex(item: Pick<MenuItem, 'price' | 'optionGroups'>) {
  if (Number(item.price) !== 0) return -1;
  return groupsOf(item).findIndex((g) => g.required && !g.multiple && g.options.some((o) => Number(o.price) > 0));
}

export function optionPriceLabel(
  item: Pick<MenuItem, 'price' | 'optionGroups'>,
  groupIndex: number,
  option: MenuOption,
  format: (n: number) => string
) {
  const price = Number(option.price) || 0;
  if (priceGroupIndex(item) === groupIndex) return format(price);
  return price > 0 ? `+ ${format(price)}` : '';
}

/** How a customer chooses within a group. */
export type Rule = 'one-required' | 'one-optional' | 'any' | 'any-required';

export const RULES: { value: Rule; label: string; short: string }[] = [
  { value: 'one-required', label: 'Must pick one', short: 'Pick 1' },
  { value: 'one-optional', label: 'May pick one', short: 'Optional · pick 1' },
  { value: 'any', label: 'May pick any', short: 'Optional · pick any' },
  { value: 'any-required', label: 'Must pick at least one', short: 'Pick 1 or more' },
];

export const ruleOf = (g: Pick<OptionGroup, 'required' | 'multiple'>): Rule =>
  g.multiple ? (g.required ? 'any-required' : 'any') : g.required ? 'one-required' : 'one-optional';

export const flagsOf = (rule: Rule) => ({
  required: rule === 'one-required' || rule === 'any-required',
  multiple: rule === 'any' || rule === 'any-required',
});

export const ruleShort = (g: Pick<OptionGroup, 'required' | 'multiple'>) => RULES.find((r) => r.value === ruleOf(g))!.short;
