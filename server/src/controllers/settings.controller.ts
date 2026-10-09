import { Response } from 'express';
import Settings, { DEFAULT_SETTINGS, NoticeDays } from '../models/Settings.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { logAudit } from '../lib/audit';
import { SECTIONS, type Section } from '../config/sections';

export interface StoreSettings {
  shopName: string;
  whatsappNumber: string;
  phone: string;
  pickupAddress: string;
  paymentInstructions: string;
  noticeDays: NoticeDays;
  openHour: number;
  closeHour: number;
  instagram: string;
}

/** Days of notice an order needs: the longest of the sections it contains. */
export const noticeDaysFor = (settings: StoreSettings, sections: Section[]) =>
  Math.max(0, ...sections.map((s) => settings.noticeDays[s] ?? 0));

// Settings are read on every menu load and every order, but only change when
// someone saves the Settings page (on this same server process), so they are
// kept in memory instead of costing a database round-trip each time.
let cached: StoreSettings | null = null;

const toPlain = (doc: any): StoreSettings => ({
  shopName: doc.shopName ?? DEFAULT_SETTINGS.shopName,
  whatsappNumber: doc.whatsappNumber ?? DEFAULT_SETTINGS.whatsappNumber,
  phone: doc.phone ?? DEFAULT_SETTINGS.phone,
  pickupAddress: doc.pickupAddress ?? DEFAULT_SETTINGS.pickupAddress,
  paymentInstructions: doc.paymentInstructions ?? DEFAULT_SETTINGS.paymentInstructions,
  noticeDays: {
    cakes: doc.noticeDays?.cakes ?? DEFAULT_SETTINGS.noticeDays.cakes,
    pastries: doc.noticeDays?.pastries ?? DEFAULT_SETTINGS.noticeDays.pastries,
    gifts: doc.noticeDays?.gifts ?? DEFAULT_SETTINGS.noticeDays.gifts,
  },
  openHour: doc.openHour ?? DEFAULT_SETTINGS.openHour,
  closeHour: doc.closeHour ?? DEFAULT_SETTINGS.closeHour,
  instagram: doc.instagram ?? DEFAULT_SETTINGS.instagram,
});

export async function getSettings(): Promise<StoreSettings> {
  if (cached) return cached;
  // Creates the document with defaults the first time — one round-trip either way.
  const doc = await Settings.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { ...DEFAULT_SETTINGS } },
    { upsert: true, new: true, lean: true }
  );
  cached = toPlain(doc);
  return cached;
}

/**
 * Accepts a Ghana number in local (024 000 0000) or international
 * (+233 24 000 0000) form and returns it the way wa.me expects: digits only,
 * with the country code.
 */
export function toWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  return digits;
}

const wholeNumber = (v: unknown) => {
  const n = Number(v);
  return v === '' || v == null || !Number.isInteger(n) ? NaN : n;
};

export const getStoreSettings = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    res.json(await getSettings());
  } catch (err) { next(err); }
};

export const updateStoreSettings = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const b = req.body ?? {};
    const current = await getSettings();
    // Dotted paths so a partial noticeDays only touches the sections sent.
    const update: Record<string, unknown> = {};
    const fail = (message: string) => res.status(400).json({ message });

    if (b.shopName !== undefined) {
      const name = String(b.shopName).trim().slice(0, 60);
      if (!name) { fail('The shop needs a name.'); return; }
      update.shopName = name;
    }
    if (b.whatsappNumber !== undefined) {
      const number = toWhatsAppNumber(String(b.whatsappNumber));
      if (number.length < 11 || number.length > 15) {
        fail('Enter a valid WhatsApp number, e.g. 024 123 4567.');
        return;
      }
      update.whatsappNumber = number;
    }
    if (b.phone !== undefined) update.phone = String(b.phone).trim().slice(0, 40);
    if (b.pickupAddress !== undefined) update.pickupAddress = String(b.pickupAddress).trim().slice(0, 200);
    if (b.paymentInstructions !== undefined) {
      update.paymentInstructions = String(b.paymentInstructions).trim().slice(0, 1000);
    }
    if (b.instagram !== undefined) {
      update.instagram = String(b.instagram).trim().replace(/^@+/, '').slice(0, 40);
    }

    if (b.noticeDays !== undefined) {
      if (!b.noticeDays || typeof b.noticeDays !== 'object') { fail('Earliest order dates could not be read.'); return; }
      for (const section of SECTIONS) {
        if (b.noticeDays[section] === undefined) continue;
        const days = wholeNumber(b.noticeDays[section]);
        if (!Number.isFinite(days) || days < 0 || days > 60) {
          fail('Earliest order date must be between 0 and 60 days ahead.');
          return;
        }
        update[`noticeDays.${section}`] = days;
      }
    }

    // Opening hours are checked as a pair, against the saved value of
    // whichever one wasn't sent.
    if (b.openHour !== undefined || b.closeHour !== undefined) {
      const openHour = b.openHour !== undefined ? wholeNumber(b.openHour) : current.openHour;
      const closeHour = b.closeHour !== undefined ? wholeNumber(b.closeHour) : current.closeHour;
      if (!Number.isFinite(openHour) || openHour < 0 || openHour > 23) { fail('Opening time must be between midnight and 11 PM.'); return; }
      if (!Number.isFinite(closeHour) || closeHour < 1 || closeHour > 24) { fail('Closing time must be between 1 AM and midnight.'); return; }
      if (openHour >= closeHour) { fail('Closing time must be after opening time.'); return; }
      update.openHour = openHour;
      update.closeHour = closeHour;
    }

    const doc = await Settings.findOneAndUpdate(
      { key: 'store' },
      { $set: update },
      { upsert: true, new: true, lean: true, runValidators: true }
    );
    cached = toPlain(doc);

    logAudit({ actorId: req.user?.id, action: 'settings.updated', entity: 'settings', meta: update });
    res.json(cached);
  } catch (err) { next(err); }
};
