import { invalidateCache } from './cache';

const ORDERS = 'sc:orders-changed';
const INVENTORY = 'sc:inventory-changed';

function listen(name: string, fn: () => void) {
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}

/** After any order change: drop cached order data and tell every view to refresh. */
export function notifyOrdersChanged() {
  invalidateCache('/orders');
  window.dispatchEvent(new Event(ORDERS));
}
export const onOrdersChanged = (fn: () => void) => listen(ORDERS, fn);

/** After any stock or stock-item change. */
export function notifyInventoryChanged() {
  invalidateCache('/inventory');
  window.dispatchEvent(new Event(INVENTORY));
}
export const onInventoryChanged = (fn: () => void) => listen(INVENTORY, fn);
