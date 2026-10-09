import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.model';
import type { IOrderItem, IOrderItemOption } from '../models/Order.model';
import { sectionOf, type Section } from '../config/sections';

const MAX_LINES = 50;
// Party trays of meat pies and puff-puff run to hundreds of pieces.
const MAX_QUANTITY = 1000;
const MAX_CUSTOM_PRICE = 1_000_000;

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

type PricedLine = Omit<IOrderItem, 'menuItemId'> & { menuItemId?: string };

/**
 * Re-prices every order line from the live menu — the browser only says what
 * was picked (item + option ids), never what it costs. Returns a
 * customer-readable error for anything that no longer adds up (item removed,
 * option gone, required choice missing).
 *
 * All menu items are fetched in ONE query, whatever the number of lines.
 */
export async function priceOrderLines(
  rawLines: unknown,
  opts: { allowCustom: boolean; allowUnavailable: boolean; enforceMinimum: boolean }
): Promise<{ items: PricedLine[]; total: number; sections: Section[] } | { error: string }> {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: 'Your order is empty.' };
  }
  if (rawLines.length > MAX_LINES) {
    return { error: `An order can have at most ${MAX_LINES} lines.` };
  }

  const ids = rawLines
    .map((l: any) => l?.menuItemId)
    .filter((id: unknown): id is string => typeof id === 'string' && mongoose.isValidObjectId(id));
  const menuItems = ids.length > 0 ? await MenuItem.find({ _id: { $in: ids } }).lean() : [];
  const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

  const items: PricedLine[] = [];
  let total = 0;

  for (const line of rawLines as any[]) {
    const quantity = Math.floor(Number(line?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: `Quantity must be between 1 and ${MAX_QUANTITY}.` };
    }

    // Off-menu item typed in by staff at the counter.
    if (line?.custom === true) {
      if (!opts.allowCustom) return { error: 'Please choose items from the menu.' };
      const name = typeof line.name === 'string' ? line.name.trim().slice(0, 100) : '';
      const price = Number(line.price);
      if (!name) return { error: 'Give the custom item a name.' };
      if (!Number.isFinite(price) || price < 0 || price > MAX_CUSTOM_PRICE) {
        return { error: `Enter a valid price for "${name}".` };
      }
      const unit = roundMoney(price);
      items.push({ name, section: '', category: 'Custom', price: unit, quantity, options: [], message: '' });
      total += unit * quantity;
      continue;
    }

    const menuItem = typeof line?.menuItemId === 'string' ? byId.get(line.menuItemId) : undefined;
    if (!menuItem) {
      return { error: 'Something in your order is no longer on the menu. Please remove it and try again.' };
    }
    if (!menuItem.available && !opts.allowUnavailable) {
      return { error: `Sorry, ${menuItem.name} is not available right now. Please remove it and try again.` };
    }
    // Staff taking an order at the counter may sell fewer than the minimum.
    const minQuantity = menuItem.minQuantity && menuItem.minQuantity > 1 ? menuItem.minQuantity : 1;
    if (opts.enforceMinimum && quantity < minQuantity) {
      return { error: `${menuItem.name} has a minimum order of ${minQuantity}. Please increase the quantity.` };
    }

    const chosenIds = new Set<string>(
      Array.isArray(line.optionIds) ? line.optionIds.filter((id: unknown) => typeof id === 'string') : []
    );
    const options: IOrderItemOption[] = [];
    let matched = 0;

    for (const group of menuItem.optionGroups ?? []) {
      const chosen = (group.options ?? []).filter((o) => chosenIds.has(o._id.toString()));
      matched += chosen.length;
      if (group.required && chosen.length === 0) {
        // "Size" reads well inline; a tick-list like "Choose your treats" doesn't.
        return {
          error: group.multiple
            ? `Please pick at least one option under “${group.name}” for ${menuItem.name}.`
            : `Please choose ${group.name.toLowerCase()} for ${menuItem.name}.`,
        };
      }
      if (!group.multiple && chosen.length > 1) {
        return { error: `Choose only one ${group.name.toLowerCase()} for ${menuItem.name}.` };
      }
      for (const o of chosen) options.push({ group: group.name, name: o.name, price: o.price });
    }
    if (matched !== chosenIds.size) {
      return { error: `An option you picked for ${menuItem.name} has changed. Please add it to your order again.` };
    }

    const message =
      menuItem.allowMessage && typeof line.message === 'string' ? line.message.trim().slice(0, 100) : '';
    const unit = roundMoney(menuItem.price + options.reduce((sum, o) => sum + o.price, 0));

    items.push({
      menuItemId: menuItem._id.toString(),
      name: menuItem.name,
      section: sectionOf(menuItem.section),
      category: menuItem.category || '',
      price: unit,
      quantity,
      options,
      message,
    });
    total += unit * quantity;
  }

  const sections = [...new Set(items.map((i) => i.section).filter(Boolean))] as Section[];
  return { items, total: roundMoney(total), sections };
}
