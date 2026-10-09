import { safeStorage } from './utils';

export interface SavedCustomer {
  name: string;
  phone: string;
  orderType: 'pickup' | 'delivery';
  address: string;
  landmark: string;
}

const KEY = 'sc-customer';

export function savedCustomer(): Partial<SavedCustomer> {
  const c = safeStorage.get<Partial<SavedCustomer>>(KEY);
  return c && typeof c === 'object' ? c : {};
}

export function saveCustomer(c: SavedCustomer) {
  safeStorage.set(KEY, c);
}

export const phoneDigits = (phone: string) => phone.replace(/\D/g, '');
export const validPhone = (phone: string) => {
  const n = phoneDigits(phone).length;
  return n >= 9 && n <= 15;
};
