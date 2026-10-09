import { Response } from 'express';
import mongoose from 'mongoose';
import InventoryItem, { IInventoryItem, INVENTORY_UNITS } from '../models/InventoryItem.model';
import StockMovement, { MOVEMENT_TYPES, MovementType } from '../models/StockMovement.model';
import { nextSequence } from '../models/Counter.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { logAudit } from '../lib/audit';

const MAX_QUANTITY = 1_000_000;
const MAX_LINES = 200;
const MAX_BARCODES = 10;
const HISTORY_PAGE_SIZE = 30;

class ValidationError extends Error {}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Stock is kept to 3 decimals (grams of a kilo) so repeated sums don't drift. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Scanners report the same product in slightly different forms: a UPC-A
 * barcode can come back as 12 digits or as 13 with a leading zero. Storing and
 * matching one form means a scan always finds its item. Mirrored in
 * admin/src/lib/inventory.ts.
 */
export function normalizeCode(raw: unknown): string {
  const code = String(raw ?? '').replace(/\s+/g, '').slice(0, 64);
  return /^0\d{12}$/.test(code) ? code.slice(1) : code;
}

const toSku = (n: number) => `SC-STK-${String(n).padStart(4, '0')}`;

function readNumber(v: unknown, label: string, { min = 0, allowEmpty = false } = {}): number | undefined {
  if (allowEmpty && (v === '' || v == null)) return undefined;
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < min || n > MAX_QUANTITY) {
    throw new ValidationError(`Enter a valid ${label}.`);
  }
  return n;
}

/** Whitelists and validates the editable fields present in the request. */
function readItemFields(body: any, { creating }: { creating: boolean }) {
  const fields: Record<string, unknown> = {};

  if (creating || body.name !== undefined) {
    const name = text(body.name, 80);
    if (!name) throw new ValidationError('Item name is required.');
    fields.name = name;
  }
  if (creating || body.unit !== undefined) {
    const unit = body.unit ?? 'pcs';
    if (!INVENTORY_UNITS.includes(unit)) throw new ValidationError('Choose a unit, e.g. kg or pcs.');
    fields.unit = unit;
  }
  if (body.category !== undefined) fields.category = text(body.category, 60);
  if (body.location !== undefined) fields.location = text(body.location, 60);
  if (body.supplier !== undefined) fields.supplier = text(body.supplier, 80);
  if (body.notes !== undefined) fields.notes = text(body.notes, 500);
  if (body.active !== undefined) fields.active = body.active === true || body.active === 'true';
  if (body.reorderLevel !== undefined) fields.reorderLevel = round3(readNumber(body.reorderLevel, 'reorder level')!);
  if (body.barcodes !== undefined) {
    if (!Array.isArray(body.barcodes)) throw new ValidationError('Barcodes could not be read. Please try again.');
    const codes = [...new Set(body.barcodes.map(normalizeCode).filter(Boolean))];
    if (codes.length > MAX_BARCODES) throw new ValidationError(`An item can have at most ${MAX_BARCODES} barcodes.`);
    fields.barcodes = codes;
  }
  return fields;
}

/** Turns "barcode already used" into a message that names the other item. */
async function duplicateBarcodeMessage(codes: string[], exceptId?: string) {
  const other = await InventoryItem.findOne({ barcodes: { $in: codes }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select('name barcodes')
    .lean();
  if (!other) return 'That barcode is already used by another item.';
  const code = codes.find((c) => other.barcodes.includes(c));
  return `Barcode ${code} is already on “${other.name}”. Each barcode can belong to one item only.`;
}

const isDuplicateKey = (err: any) => err?.code === 11000;

export const listItems = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const items = await InventoryItem.find().sort({ name: 1 }).lean();
    res.json({ items });
  } catch (err) { next(err); }
};

export const createItem = async (req: AuthRequest, res: Response, next: any) => {
  let fields: Record<string, unknown> = {};
  try {
    fields = readItemFields(req.body, { creating: true });
    const opening = readNumber(req.body.openingStock, 'opening stock', { allowEmpty: true }) ?? 0;
    const cost = readNumber(req.body.unitCost, 'cost', { allowEmpty: true });
    const sku = toSku(await nextSequence('inventoryItem', 0));

    const item = await InventoryItem.create({
      ...fields,
      sku,
      onHand: round3(opening),
      avgCost: cost !== undefined ? round4(cost) : 0,
    });

    if (opening > 0) {
      await StockMovement.create({
        item: item._id,
        itemName: item.name,
        unit: item.unit,
        type: 'adjust',
        quantity: round3(opening),
        unitCost: cost,
        balanceAfter: item.onHand,
        note: 'Opening stock',
        actorId: req.user?.id,
      });
    }

    logAudit({ actorId: req.user?.id, action: 'inventory.item_created', entity: 'inventory', entityId: item.id, meta: { name: item.name, sku, opening } });
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    if (isDuplicateKey(err)) { res.status(409).json({ message: await duplicateBarcodeMessage((fields.barcodes as string[]) ?? []) }); return; }
    next(err);
  }
};

export const updateItem = async (req: AuthRequest, res: Response, next: any) => {
  let fields: Record<string, unknown> = {};
  try {
    fields = readItemFields(req.body, { creating: false });
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true, lean: true });
    if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
    logAudit({ actorId: req.user?.id, action: 'inventory.item_updated', entity: 'inventory', entityId: String(item._id), meta: { name: item.name, fields: Object.keys(fields) } });
    res.json(item);
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    if (isDuplicateKey(err)) {
      res.status(409).json({ message: await duplicateBarcodeMessage((fields.barcodes as string[]) ?? [], String(req.params.id)) });
      return;
    }
    next(err);
  }
};

/** Only items that never moved can be deleted; anything with history is archived instead. */
export const deleteItem = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const hasHistory = await StockMovement.exists({ item: req.params.id, note: { $ne: 'Opening stock' } });
    if (hasHistory) {
      res.status(409).json({ message: 'This item has stock history, so it can’t be deleted. Archive it instead.' });
      return;
    }
    const item = await InventoryItem.findByIdAndDelete(req.params.id).lean();
    if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
    await StockMovement.deleteMany({ item: item._id });
    logAudit({ actorId: req.user?.id, action: 'inventory.item_deleted', entity: 'inventory', entityId: String(item._id), meta: { name: item.name } });
    res.json({ message: 'Item deleted' });
  } catch (err) { next(err); }
};

interface Line { itemId: string; quantity: number; unitCost?: number }

/** Validates submitted lines and merges repeats of the same item into one. */
function readLines(raw: unknown, { costs, allowZero }: { costs: boolean; allowZero: boolean }): Line[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ValidationError('Add at least one item.');
  if (raw.length > MAX_LINES) throw new ValidationError(`Save at most ${MAX_LINES} items at a time.`);

  const merged = new Map<string, Line>();
  for (const l of raw) {
    const itemId = String(l?.itemId ?? '');
    if (!mongoose.isValidObjectId(itemId)) throw new ValidationError('One of the items could not be found. Refresh and try again.');
    const quantity = Number(l.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || (!allowZero && quantity === 0) || quantity > MAX_QUANTITY) {
      throw new ValidationError(allowZero ? 'Enter the counted quantity for every item (0 or more).' : 'Every item needs a quantity above 0.');
    }
    const unitCost = costs ? readNumber(l.unitCost, 'cost per unit', { allowEmpty: true }) : undefined;

    const existing = merged.get(itemId);
    if (existing && !allowZero) {
      existing.quantity += quantity;
      if (unitCost !== undefined) existing.unitCost = unitCost;
    } else {
      merged.set(itemId, { itemId, quantity: round3(quantity), unitCost });
    }
  }
  return [...merged.values()].map((l) => ({ ...l, quantity: round3(l.quantity) }));
}

/** Loads the items a batch refers to, in one query, failing if any are missing or archived. */
async function loadLineItems(lines: Line[]) {
  const items = await InventoryItem.find({ _id: { $in: lines.map((l) => l.itemId) } })
    .select('name unit onHand avgCost active')
    .lean<(Pick<IInventoryItem, 'name' | 'unit' | 'onHand' | 'avgCost' | 'active'> & { _id: mongoose.Types.ObjectId })[]>();
  const byId = new Map(items.map((i) => [String(i._id), i]));
  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item) throw new ValidationError('One of the items no longer exists. Refresh and try again.');
    if (item.active === false) throw new ValidationError(`“${item.name}” is archived. Restore it before changing its stock.`);
  }
  return byId;
}

const fmtQty = (n: number, unit: string) => `${Number(n.toFixed(3))} ${unit}`;

/**
 * Stock coming in (a delivery) or going out (used in baking, or wasted).
 *
 * The whole batch costs three round-trips whatever its size: read the items,
 * then update their stock and write the history together. Each stock update
 * is computed inside the database from the current value, so two phones
 * saving at once can't overwrite each other.
 */
export const recordMovements = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const type = req.body?.type as MovementType;
    if (!['receive', 'use', 'waste'].includes(type)) throw new ValidationError('Choose what happened to the stock.');
    const receiving = type === 'receive';
    const lines = readLines(req.body.lines, { costs: receiving, allowZero: false });
    const note = text(req.body.note, 200);
    const supplier = receiving ? text(req.body.supplier, 80) : '';

    const [byId, reference] = await Promise.all([
      loadLineItems(lines),
      receiving ? nextSequence('grn').then((n) => `GRN-${n}`) : Promise.resolve(''),
    ]);

    if (!receiving) {
      const short = lines.filter((l) => l.quantity > byId.get(l.itemId)!.onHand + 1e-9);
      if (short.length > 0) {
        const list = short.map((l) => {
          const item = byId.get(l.itemId)!;
          return `${item.name} (only ${fmtQty(Math.max(item.onHand, 0), item.unit)} in stock)`;
        });
        throw new ValidationError(
          `Not enough stock: ${list.join(', ')}. If the stock number is wrong, do a stock count to correct it first.`
        );
      }
    }

    const now = new Date();
    const results = lines.map((line) => {
      const item = byId.get(line.itemId)!;
      const delta = receiving ? line.quantity : -line.quantity;
      const balanceAfter = round3(item.onHand + delta);
      const priced = receiving && line.unitCost !== undefined;
      const prior = Math.max(item.onHand, 0);
      const avgCost = priced ? round4(prior + line.quantity > 0 ? (prior * item.avgCost + line.quantity * line.unitCost!) / (prior + line.quantity) : line.unitCost!) : item.avgCost;
      return { line, item, delta, balanceAfter, avgCost, priced };
    });

    const ops = results.map(({ line, delta, priced }) => {
      const priorExpr = { $max: ['$onHand', 0] };
      const set: Record<string, unknown> = { onHand: { $round: [{ $add: ['$onHand', delta] }, 3] } };
      if (priced) {
        // Weighted average of what was on the shelf and what just arrived,
        // evaluated against the stored values in the same atomic update.
        set.avgCost = {
          $round: [
            {
              $cond: [
                { $gt: [{ $add: [priorExpr, line.quantity] }, 0] },
                {
                  $divide: [
                    { $add: [{ $multiply: [priorExpr, { $ifNull: ['$avgCost', 0] }] }, line.quantity * line.unitCost!] },
                    { $add: [priorExpr, line.quantity] },
                  ],
                },
                line.unitCost!,
              ],
            },
            4,
          ],
        };
      }
      set.updatedAt = now;
      return { updateOne: { filter: { _id: new mongoose.Types.ObjectId(line.itemId) }, update: [{ $set: set }] } };
    });

    const movements = results.map(({ line, item, delta, balanceAfter }) => ({
      item: item._id,
      itemName: item.name,
      unit: item.unit,
      type,
      quantity: delta,
      ...(receiving && line.unitCost !== undefined ? { unitCost: line.unitCost } : {}),
      balanceAfter,
      reference,
      supplier,
      note,
      actorId: req.user?.id,
    }));

    await Promise.all([InventoryItem.collection.bulkWrite(ops, { ordered: false }), StockMovement.insertMany(movements)]);

    logAudit({
      actorId: req.user?.id,
      action: `inventory.${type}`,
      entity: 'inventory',
      entityId: reference || undefined,
      meta: { lines: results.map((r) => ({ name: r.item.name, quantity: r.delta })), supplier, note },
    });

    res.status(201).json({
      reference,
      items: results.map((r) => ({ _id: r.item._id, onHand: r.balanceAfter, avgCost: r.avgCost })),
    });
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    next(err);
  }
};

/**
 * A stock count: what is actually on the shelf becomes the stock level, and
 * the difference is recorded so the history still adds up. Also used to
 * correct a single item's stock.
 */
export const recordCount = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const lines = readLines(
      (Array.isArray(req.body?.lines) ? req.body.lines : []).map((l: any) => ({ itemId: l?.itemId, quantity: l?.counted })),
      { costs: false, allowZero: true }
    );
    const note = text(req.body.note, 200);

    const [byId, reference] = await Promise.all([loadLineItems(lines), nextSequence('stockCount').then((n) => `CNT-${n}`)]);

    const now = new Date();
    const ops = lines.map((line) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(line.itemId) },
        update: { $set: { onHand: line.quantity, lastCountedAt: now, updatedAt: now } },
      },
    }));
    const movements = lines.map((line) => {
      const item = byId.get(line.itemId)!;
      return {
        item: item._id,
        itemName: item.name,
        unit: item.unit,
        type: 'count' as const,
        quantity: round3(line.quantity - item.onHand),
        balanceAfter: line.quantity,
        reference,
        note,
        actorId: req.user?.id,
      };
    });

    await Promise.all([InventoryItem.collection.bulkWrite(ops, { ordered: false }), StockMovement.insertMany(movements)]);

    const changed = movements.filter((m) => m.quantity !== 0);
    logAudit({
      actorId: req.user?.id,
      action: 'inventory.count',
      entity: 'inventory',
      entityId: reference,
      meta: { counted: movements.length, changed: changed.map((m) => ({ name: m.itemName, difference: m.quantity })), note },
    });

    res.status(201).json({
      reference,
      changed: changed.length,
      items: lines.map((l) => ({ _id: l.itemId, onHand: l.quantity, lastCountedAt: now })),
    });
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    next(err);
  }
};

/** Stock history, newest first, with who made each change — one round-trip. */
export const listMovements = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const match: Record<string, unknown> = {};
    if (typeof req.query.item === 'string' && mongoose.isValidObjectId(req.query.item)) {
      match.item = new mongoose.Types.ObjectId(req.query.item);
    }
    if (typeof req.query.type === 'string' && (MOVEMENT_TYPES as readonly string[]).includes(req.query.type)) {
      match.type = req.query.type;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || HISTORY_PAGE_SIZE, 1), 100);
    const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);

    const [result] = await StockMovement.aggregate([
      { $match: match },
      {
        $facet: {
          movements: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'actorId',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1 } }],
                as: 'actor',
              },
            },
            { $addFields: { actorName: { $ifNull: [{ $first: '$actor.name' }, ''] } } },
            { $project: { actor: 0 } },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    res.json({ movements: result.movements, total: result.total[0]?.n ?? 0, page, pageSize: limit });
  } catch (err) { next(err); }
};
