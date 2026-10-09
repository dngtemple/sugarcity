import mongoose, { Document, Schema } from 'mongoose';

export const INVENTORY_UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box', 'bag', 'tray', 'bottle', 'tin', 'roll'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

/** Something the shop buys and stores: an ingredient, packaging, decorations… */
export interface IInventoryItem extends Document {
  name: string;
  /** Our own code, e.g. SC-STK-0042. Printed on QR labels for goods with no barcode. */
  sku: string;
  /** Manufacturer barcodes. Several brands of the same thing can share one item. */
  barcodes: string[];
  category: string;
  unit: InventoryUnit;
  /** "Running low" once stock falls to this level. 0 turns the warning off. */
  reorderLevel: number;
  location: string;
  supplier: string;
  notes: string;
  active: boolean;
  /**
   * Current stock. Kept up to date by every stock movement, so the list page
   * never has to add up the history.
   */
  onHand: number;
  /** Average price paid per unit, updated on each delivery that has a cost. */
  avgCost: number;
  lastCountedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    barcodes: { type: [String], default: [] },
    category: { type: String, default: '', trim: true },
    unit: { type: String, enum: INVENTORY_UNITS, default: 'pcs' },
    reorderLevel: { type: Number, default: 0, min: 0 },
    location: { type: String, default: '', trim: true },
    supplier: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    onHand: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0, min: 0 },
    lastCountedAt: { type: Date },
  },
  { timestamps: true }
);

// A barcode can only belong to one item, or a scan would be ambiguous. The
// partial filter skips items with no barcodes — otherwise every such item
// would collide on the "empty" key.
InventoryItemSchema.index(
  { barcodes: 1 },
  { unique: true, partialFilterExpression: { barcodes: { $type: 'string' } } }
);

export default mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
