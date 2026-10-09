import { Response } from 'express';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { logAudit } from '../lib/audit';
import { uploadMenuImage, deleteMenuImage } from '../lib/cloudinary';
import { getSettings } from './settings.controller';
import { SECTIONS, sectionOf } from '../config/sections';

const MAX_GROUPS = 10;
const MAX_OPTIONS = 40;
const MAX_PRICE = 1_000_000;
const MAX_MIN_QUANTITY = 1000;

/**
 * Fills in section, minimum and gift flag for any item missing them (e.g. one
 * inserted by hand in the database), so the front ends never see undefined.
 */
const withDefaults = <T extends { section?: unknown; minQuantity?: number; isGift?: boolean }>(item: T) => ({
  ...item,
  section: sectionOf(item.section),
  minQuantity: item.minQuantity && item.minQuantity > 1 ? item.minQuantity : 1,
  isGift: item.isGift === true,
});

// The public menu and the shop settings travel together so the website loads
// with a single request.
export const getMenu = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const [items, settings] = await Promise.all([
      MenuItem.find({ available: true }).sort({ category: 1, name: 1 }).lean(),
      getSettings(),
    ]);
    res.json({ items: items.map(withDefaults), settings });
  } catch (err) { next(err); }
};

export const getAllMenu = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const items = await MenuItem.find().sort({ category: 1, name: 1 }).lean();
    res.json({ items: items.map(withDefaults) });
  } catch (err) { next(err); }
};

const toBool = (v: unknown) => v === true || v === 'true';

class ValidationError extends Error {}

/**
 * Menu forms are posted as multipart (for the photo), so option groups arrive
 * as a JSON string. Existing option ids are kept so carts that reference them
 * stay valid across an edit.
 */
function parseOptionGroups(raw: unknown) {
  let groups: unknown = raw;
  if (typeof raw === 'string') {
    try { groups = JSON.parse(raw); } catch { throw new ValidationError('Options could not be read. Please try again.'); }
  }
  if (!Array.isArray(groups)) throw new ValidationError('Options could not be read. Please try again.');
  if (groups.length > MAX_GROUPS) throw new ValidationError(`An item can have at most ${MAX_GROUPS} option groups.`);

  return groups.map((g: any, gi: number) => {
    const name = typeof g?.name === 'string' ? g.name.trim().slice(0, 40) : '';
    if (!name) throw new ValidationError(`Option group ${gi + 1} needs a name (e.g. Size).`);
    const options = Array.isArray(g.options) ? g.options : [];
    if (options.length === 0) throw new ValidationError(`Add at least one option to "${name}".`);
    if (options.length > MAX_OPTIONS) throw new ValidationError(`"${name}" can have at most ${MAX_OPTIONS} options.`);

    return {
      ...(mongoose.isValidObjectId(g._id) ? { _id: g._id } : {}),
      name,
      required: toBool(g.required),
      multiple: toBool(g.multiple),
      options: options.map((o: any, oi: number) => {
        const optionName = typeof o?.name === 'string' ? o.name.trim().slice(0, 60) : '';
        if (!optionName) throw new ValidationError(`Option ${oi + 1} in "${name}" needs a name.`);
        const price = o.price === '' || o.price == null ? 0 : Number(o.price);
        if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
          throw new ValidationError(`Enter a valid price for "${optionName}" in "${name}".`);
        }
        return {
          ...(mongoose.isValidObjectId(o._id) ? { _id: o._id } : {}),
          name: optionName,
          price: Math.round(price * 100) / 100,
        };
      }),
    };
  });
}

/** Whitelists and validates the editable fields present in the request. */
function readMenuFields(body: any, { creating }: { creating: boolean }) {
  const fields: Record<string, unknown> = {};

  if (creating || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!name) throw new ValidationError('Item name is required.');
    fields.name = name;
  }
  if (creating || body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 60) : '';
    if (!category) throw new ValidationError('Category is required.');
    fields.category = category;
  }
  if (creating || body.price !== undefined) {
    const price = Number(body.price);
    if (body.price === '' || !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
      throw new ValidationError('Enter a valid price (use 0 if the price comes from the options).');
    }
    fields.price = Math.round(price * 100) / 100;
  }
  if (creating || body.section !== undefined) {
    if (body.section !== undefined && !SECTIONS.includes(body.section)) throw new ValidationError('Choose Cakes, Pastries & Treats or Gift Boxes.');
    fields.section = sectionOf(body.section);
  }
  if (body.minQuantity !== undefined) {
    const min = body.minQuantity === '' ? 1 : Number(body.minQuantity);
    if (!Number.isInteger(min) || min < 1 || min > MAX_MIN_QUANTITY) {
      throw new ValidationError(`Minimum order must be a whole number from 1 to ${MAX_MIN_QUANTITY}.`);
    }
    fields.minQuantity = min;
  }
  if (body.isGift !== undefined) fields.isGift = toBool(body.isGift);
  if (body.description !== undefined) fields.description = String(body.description).trim().slice(0, 500);
  if (body.available !== undefined) fields.available = toBool(body.available);
  if (body.popular !== undefined) fields.popular = toBool(body.popular);
  if (body.allowMessage !== undefined) fields.allowMessage = toBool(body.allowMessage);
  if (body.optionGroups !== undefined) fields.optionGroups = parseOptionGroups(body.optionGroups);

  return fields;
}

export const createMenuItem = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const fields = readMenuFields(req.body, { creating: true });
    const file = (req as any).file;
    const image = file ? await uploadMenuImage(file.buffer) : '';
    const item = await MenuItem.create({ available: true, ...fields, image });
    logAudit({ actorId: req.user?.id, action: 'menu.created', entity: 'menu', entityId: item.id, meta: { name: item.name, category: item.category, price: item.price } });
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    next(err);
  }
};

export const updateMenuItem = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const fields = readMenuFields(req.body, { creating: false });
    const item = await MenuItem.findById(req.params.id);
    if (!item) { res.status(404).json({ message: 'Menu item not found' }); return; }

    const file = (req as any).file;
    if (file || toBool(req.body.removeImage)) {
      if (item.image) await deleteMenuImage(item.image);
      item.image = file ? await uploadMenuImage(file.buffer) : '';
    }
    item.set(fields);
    await item.save();

    logAudit({
      actorId: req.user?.id,
      action: 'menu.updated',
      entity: 'menu',
      entityId: item.id,
      meta: { name: item.name, fields: Object.keys(fields) },
    });
    res.json(item);
  } catch (err) {
    if (err instanceof ValidationError) { res.status(400).json({ message: err.message }); return; }
    next(err);
  }
};

export const deleteMenuItem = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ message: 'Menu item not found' }); return; }
    if (item.image) await deleteMenuImage(item.image);
    logAudit({ actorId: req.user?.id, action: 'menu.deleted', entity: 'menu', entityId: item.id, meta: { name: item.name } });
    res.json({ message: 'Menu item deleted' });
  } catch (err) { next(err); }
};
