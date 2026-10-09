import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuItem, Section } from '../lib/menu';

export interface BagOption {
  groupId: string;
  group: string;
  optionId: string;
  name: string;
  price: number;
}

export interface BagLine {
  key: string;
  menuItemId: string;
  name: string;
  image?: string;
  section: Section;
  options: BagOption[];
  message: string;
  unitPrice: number;
  quantity: number;
  minQuantity: number;
  isGift: boolean;
}

export type NewBagLine = Omit<BagLine, 'key'>;

export const MAX_QUANTITY = 1000;

/** Same item, same choices, same message → one line. */
const lineKey = (l: NewBagLine) =>
  [l.menuItemId, ...l.options.map((o) => o.optionId).sort(), l.message.trim().toLowerCase()].join('|');

export interface ReconcileNotice {
  removed: string[];
  repriced: string[];
}

interface BagState {
  lines: BagLine[];
  open: boolean;
  notice: ReconcileNotice | null;
  setOpen: (open: boolean) => void;
  add: (line: NewBagLine) => void;
  /** Going below the item's minimum removes the line. */
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  dismissNotice: () => void;
  /** Checks the saved bag against the live menu. */
  reconcile: (menu: MenuItem[]) => void;
}

export const bagCount = (lines: BagLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const bagTotal = (lines: BagLine[]) => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

export const useBag = create<BagState>()(
  persist(
    (set, get) => ({
      lines: [],
      open: false,
      notice: null,

      setOpen: (open) => set({ open }),

      add: (line) => {
        const key = lineKey(line);
        const existing = get().lines.find((l) => l.key === key);
        set({
          lines: existing
            ? get().lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) } : l))
            : [...get().lines, { ...line, key }],
        });
      },

      setQuantity: (key, quantity) =>
        set({
          lines: get().lines.flatMap((l) => {
            if (l.key !== key) return [l];
            if (quantity < (l.minQuantity || 1)) return [];
            return [{ ...l, quantity: Math.min(MAX_QUANTITY, quantity) }];
          }),
        }),

      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),

      clear: () => set({ lines: [], notice: null }),

      dismissNotice: () => set({ notice: null }),

      // A bag can sit in the browser for days: drop what can't be ordered any
      // more and pick up price changes before anyone sees a total.
      reconcile: (menu) => {
        const byId = new Map(menu.map((m) => [m._id, m]));
        const removed: string[] = [];
        const repriced: string[] = [];
        const next: BagLine[] = [];

        for (const line of get().lines) {
          const item = byId.get(line.menuItemId);
          const groups = item?.optionGroups ?? [];
          const options = line.options.map((o) => {
            const group = groups.find((g) => g._id === o.groupId);
            const option = group?.options.find((x) => x._id === o.optionId);
            return group && option ? { ...o, group: group.name, name: option.name, price: option.price } : null;
          });
          const valid =
            item?.available !== false &&
            options.every(Boolean) &&
            groups.every((g) => !g.required || line.options.some((o) => o.groupId === g._id));

          if (!item || !valid) {
            removed.push(line.name);
            continue;
          }
          const fresh = options as BagOption[];
          const price = item.price + fresh.reduce((sum, o) => sum + o.price, 0);
          if (price !== line.unitPrice) repriced.push(item.name);
          next.push({
            ...line,
            name: item.name,
            image: item.image,
            section: item.section,
            minQuantity: item.minQuantity,
            isGift: item.isGift,
            quantity: Math.max(line.quantity, item.minQuantity),
            options: fresh,
            unitPrice: price,
            message: item.allowMessage ? line.message : '',
          });
        }

        set({
          lines: next,
          notice: removed.length || repriced.length ? { removed, repriced } : get().notice,
        });
      },
    }),
    { name: 'sc-bag', partialize: (s) => ({ lines: s.lines }) }
  )
);
