/* Mirrors the server's InventoryItem and StockMovement models. */

export const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box', 'bag', 'tray', 'bottle', 'tin', 'roll'] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  pcs: 'pieces',
  kg: 'kilograms',
  g: 'grams',
  L: 'litres',
  ml: 'millilitres',
  pack: 'packs',
  box: 'boxes',
  bag: 'bags',
  tray: 'trays (eggs)',
  bottle: 'bottles',
  tin: 'tins',
  roll: 'rolls (foil, film)',
};

/** Weighed or poured units take decimals; everything else is counted. */
export const isMeasured = (unit: string) => ['kg', 'g', 'L', 'ml'].includes(unit);

export interface InventoryItem {
  _id: string;
  name: string;
  sku: string;
  barcodes: string[];
  category: string;
  unit: Unit;
  reorderLevel: number;
  location: string;
  supplier: string;
  notes: string;
  active: boolean;
  onHand: number;
  avgCost: number;
  lastCountedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ItemPatch = Pick<InventoryItem, '_id'> & Partial<InventoryItem>;

export type MovementType = 'receive' | 'use' | 'waste' | 'count' | 'adjust';

export interface StockMovement {
  _id: string;
  item: string;
  itemName: string;
  unit: string;
  type: MovementType;
  quantity: number;
  unitCost?: number;
  balanceAfter: number;
  reference?: string;
  supplier?: string;
  note?: string;
  actorName?: string;
  createdAt: string;
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receive: 'Received',
  use: 'Used',
  waste: 'Wasted',
  count: 'Counted',
  adjust: 'Adjusted',
};

/**
 * One spelling per code so a scan always finds its item: a UPC-A barcode can
 * read as 12 digits or as 13 with a leading zero. Matches the server.
 */
export function normalizeCode(raw: string) {
  const code = raw.replace(/\s+/g, '').slice(0, 64);
  return /^0\d{12}$/.test(code) ? code.slice(1) : code;
}

/** The item a scanned code belongs to — a pack barcode or our own SKU label. */
export function findByCode(items: readonly InventoryItem[], raw: string) {
  const code = normalizeCode(raw);
  const upper = code.toUpperCase();
  return items.find((i) => i.barcodes.includes(code) || i.sku.toUpperCase() === upper);
}

const qty = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 3 });

export const formatQty = (n: number, unit: string) => `${qty.format(n)} ${unit}`;

export function formatDelta(n: number, unit: string) {
  if (n === 0) return `±0 ${unit}`;
  return `${n > 0 ? '+' : '−'}${formatQty(Math.abs(n), unit)}`;
}

export type StockLevel = 'out' | 'low' | 'ok';

export function stockLevel(item: Pick<InventoryItem, 'onHand' | 'reorderLevel'>): StockLevel {
  if (item.onHand <= 0) return 'out';
  if (item.reorderLevel > 0 && item.onHand <= item.reorderLevel) return 'low';
  return 'ok';
}

export const needsRestock = (item: InventoryItem) => item.active && stockLevel(item) !== 'ok';

/** A typed quantity; a comma works as the decimal mark. NaN when not a number. */
export function parseQty(value: string) {
  const n = Number(value.replace(',', '.').trim());
  return value.trim() !== '' && Number.isFinite(n) ? n : NaN;
}

export const trimNumber = (n: number) => String(Math.round(n * 1000) / 1000);

export const stockValue = (items: InventoryItem[]) =>
  items.reduce((sum, i) => sum + (i.active && i.onHand > 0 ? i.onHand * (i.avgCost || 0) : 0), 0);
