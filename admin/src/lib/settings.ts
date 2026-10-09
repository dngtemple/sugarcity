import type { Collection } from './menu';

export interface ShopSettings {
  shopName: string;
  whatsappNumber: string;
  phone: string;
  pickupAddress: string;
  paymentInstructions: string;
  noticeDays: Record<Collection, number>;
  openHour: number;
  closeHour: number;
  instagram: string;
}

export const FALLBACK_SETTINGS: ShopSettings = {
  shopName: 'Sugar City',
  whatsappNumber: '',
  phone: '',
  pickupAddress: '',
  paymentInstructions: '',
  noticeDays: { cakes: 2, pastries: 1, gifts: 1 },
  openHour: 8,
  closeHour: 19,
  instagram: '',
};

/** Fills gaps so an older or partial settings document is still safe to use. */
export function withDefaults(s: Partial<ShopSettings> | null | undefined): ShopSettings {
  return {
    ...FALLBACK_SETTINGS,
    ...(s ?? {}),
    noticeDays: { ...FALLBACK_SETTINGS.noticeDays, ...(s?.noticeDays ?? {}) },
  };
}
