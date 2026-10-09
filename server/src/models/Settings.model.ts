import mongoose, { Document, Schema } from 'mongoose';

export interface NoticeDays {
  cakes: number;
  pastries: number;
  gifts: number;
}

// A single document (key: 'store') holding the shop details the owner can
// change from the admin Settings page without a redeploy.
export interface ISettings extends Document {
  key: 'store';
  shopName: string;
  /** Orders are sent to this WhatsApp number, in international format (233...). */
  whatsappNumber: string;
  /** Contact number shown on the website. */
  phone: string;
  pickupAddress: string;
  /** Shown to the customer after they place an order, and in the footer. */
  paymentInstructions: string;
  /**
   * How many days ahead the earliest pickup/delivery date is, per section.
   * 0 = today. An order uses the longest notice of what's in it.
   */
  noticeDays: NoticeDays;
  /** First pickup/delivery slot of the day (24h clock). */
  openHour: number;
  /** Slots run up to this hour; the last one starts at closeHour - 1. */
  closeHour: number;
  /** Instagram handle without the @, shown in the website footer. */
  instagram: string;
  updatedAt: Date;
}

export const DEFAULT_SETTINGS = {
  shopName: 'Sugar City',
  // Placeholder — the owner sets the real number in Settings.
  whatsappNumber: '233200000000',
  phone: '',
  pickupAddress: 'Accra, Ghana',
  paymentInstructions:
    'Mobile Money: 020 000 0000 (Sugar City)\n' +
    'Use your order number as the payment reference.\n' +
    '(Placeholder — update these payment details in Settings.)',
  noticeDays: { cakes: 1, pastries: 0, gifts: 1 } as NoticeDays,
  openHour: 8,
  closeHour: 19,
  instagram: '',
};

const noticeField = (def: number) => ({ type: Number, default: def, min: 0, max: 60 });

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, default: 'store' },
    shopName: { type: String, default: DEFAULT_SETTINGS.shopName },
    whatsappNumber: { type: String, default: DEFAULT_SETTINGS.whatsappNumber },
    phone: { type: String, default: DEFAULT_SETTINGS.phone },
    pickupAddress: { type: String, default: DEFAULT_SETTINGS.pickupAddress },
    paymentInstructions: { type: String, default: DEFAULT_SETTINGS.paymentInstructions },
    noticeDays: {
      cakes: noticeField(DEFAULT_SETTINGS.noticeDays.cakes),
      pastries: noticeField(DEFAULT_SETTINGS.noticeDays.pastries),
      gifts: noticeField(DEFAULT_SETTINGS.noticeDays.gifts),
    },
    openHour: { type: Number, default: DEFAULT_SETTINGS.openHour, min: 0, max: 23 },
    closeHour: { type: Number, default: DEFAULT_SETTINGS.closeHour, min: 1, max: 24 },
    instagram: { type: String, default: DEFAULT_SETTINGS.instagram },
  },
  { timestamps: true }
);

export default mongoose.model<ISettings>('Settings', SettingsSchema);
