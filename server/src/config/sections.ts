/**
 * The three collections on the menu. Every menu item belongs to one;
 * categories (e.g. "Cupcakes") sit inside a section. Mirrored in
 * client/src/lib/menu.ts and admin/src/lib/menu.ts.
 */
export const SECTIONS = ['cakes', 'pastries', 'gifts'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  cakes: 'Cakes',
  pastries: 'Pastries & Treats',
  gifts: 'Gift Boxes',
};

export const SECTION_BLURBS: Record<Section, string> = {
  cakes: 'Birthdays, weddings and every celebration in between',
  pastries: 'Cupcakes, doughnuts, cookies, pies and party trays',
  gifts: 'Sweet surprises delivered to someone special',
};

/** Anything without a recognised section is treated as a cake. */
export const sectionOf = (value: unknown): Section =>
  SECTIONS.includes(value as Section) ? (value as Section) : 'cakes';
