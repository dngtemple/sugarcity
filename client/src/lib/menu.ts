import { Cake, Cookie, Gift, type LucideIcon } from 'lucide-react';

export interface MenuOption {
  _id: string;
  name: string;
  price: number;
}

export interface OptionGroup {
  _id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: MenuOption[];
}

export const SECTIONS = ['cakes', 'pastries', 'gifts'] as const;
export type Section = (typeof SECTIONS)[number];

export const isSection = (value: unknown): value is Section => SECTIONS.includes(value as Section);

export const SECTION_INFO: Record<Section, { label: string; short: string; blurb: string; icon: LucideIcon }> = {
  cakes: { label: 'Cakes', short: 'Cakes', blurb: 'Birthdays, weddings and every celebration in between', icon: Cake },
  pastries: { label: 'Pastries & Treats', short: 'Pastries', blurb: 'Cupcakes, doughnuts, cookies, pies and party trays', icon: Cookie },
  gifts: { label: 'Gift Boxes', short: 'Gifts', blurb: 'Sweet surprises delivered to someone special', icon: Gift },
};

export interface MenuItem {
  _id: string;
  name: string;
  section: Section;
  category: string;
  description?: string;
  price: number;
  image?: string;
  popular?: boolean;
  allowMessage?: boolean;
  minQuantity: number;
  isGift: boolean;
  available: boolean;
  optionGroups?: OptionGroup[];
}

export interface StoreSettings {
  shopName: string;
  whatsappNumber: string;
  phone: string;
  pickupAddress: string;
  paymentInstructions: string;
  noticeDays: Record<Section, number>;
  openHour: number;
  closeHour: number;
  instagram: string;
}

/** Used until the menu arrives, or if it never does. */
export const FALLBACK_SETTINGS: StoreSettings = {
  shopName: 'Sugar City',
  whatsappNumber: '233200000000',
  phone: '',
  pickupAddress: '',
  paymentInstructions: '',
  noticeDays: { cakes: 0, pastries: 0, gifts: 0 },
  openHour: 8,
  closeHour: 19,
  instagram: '',
};

/** Merges whatever the server sent over the fallback, field by field. */
export function normaliseSettings(raw: Partial<StoreSettings> | undefined): StoreSettings {
  const s = { ...FALLBACK_SETTINGS, ...(raw ?? {}) };
  const nd = raw?.noticeDays ?? FALLBACK_SETTINGS.noticeDays;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    ...s,
    noticeDays: {
      cakes: num(nd.cakes, 0),
      pastries: num(nd.pastries, 0),
      gifts: num(nd.gifts, 0),
    },
    openHour: num(s.openHour, 8),
    closeHour: num(s.closeHour, 19),
    instagram: (s.instagram ?? '').replace(/^@/, ''),
  };
}

/** Days of notice a bag needs: the longest of its collections. */
export function noticeDaysFor(settings: StoreSettings, sections: Iterable<Section>) {
  return Math.max(0, ...[...sections].map((s) => settings.noticeDays[s] ?? 0));
}

/** Chosen option ids per group id. */
export type Selection = Record<string, string[]>;

const groupsOf = (item: MenuItem) => item.optionGroups ?? [];

/** Base price plus the cheapest pick in every required group; `from` when options can raise it. */
export function startingPrice(item: MenuItem): { amount: number; from: boolean } {
  let amount = item.price;
  let from = false;
  for (const group of groupsOf(item)) {
    const prices = group.options.map((o) => o.price);
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
      .filter((o) => selection[group._id]?.includes(o._id))
      .map((o) => ({ groupId: group._id, group: group.name, optionId: o._id, name: o.name, price: o.price }))
  );
}

export function unitPrice(item: MenuItem, selection: Selection) {
  return item.price + chosenOptions(item, selection).reduce((sum, o) => sum + o.price, 0);
}

export function missingGroups(item: MenuItem, selection: Selection) {
  return groupsOf(item).filter((g) => g.required && !selection[g._id]?.length);
}

/**
 * How an option's price reads on its tile. When the item has no base price the
 * first required single-choice group with prices sets the price, so it shows
 * plainly; other priced options are add-ons ("+GH₵ 20"); free ones show nothing.
 */
export function optionPriceLabel(item: MenuItem, group: OptionGroup, option: MenuOption, format: (n: number) => string) {
  const priceGroup =
    item.price === 0
      ? groupsOf(item).find((g) => g.required && !g.multiple && g.options.some((o) => o.price > 0))
      : undefined;
  if (priceGroup?._id === group._id) return format(option.price);
  return option.price > 0 ? `+${format(option.price)}` : '';
}

/** Category names in menu order (server sorts by category then name). */
export function categoriesOf(items: MenuItem[]) {
  const seen: string[] = [];
  for (const i of items) if (!seen.includes(i.category)) seen.push(i.category);
  return seen;
}

export const categoryId = (section: string, category: string) =>
  `cat-${section}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const productPath = (item: Pick<MenuItem, '_id' | 'section'>) => `/menu/${item.section}/${item._id}`;
