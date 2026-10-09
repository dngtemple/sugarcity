import mongoose, { Document, Schema } from 'mongoose';

export const MOVEMENT_TYPES = ['receive', 'use', 'waste', 'count', 'adjust'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * One change to one item's stock. The history is never edited: a mistake is
 * put right with a stock count, which records the correction as its own line.
 */
export interface IStockMovement extends Document {
  item: mongoose.Types.ObjectId;
  /** Copied from the item so the history reads correctly after a rename. */
  itemName: string;
  unit: string;
  type: MovementType;
  /** Positive when stock comes in, negative when it goes out. */
  quantity: number;
  /** Price per unit, for deliveries. */
  unitCost?: number;
  balanceAfter: number;
  /** Groups the lines saved together, e.g. GRN-1004 for one delivery. */
  reference: string;
  supplier: string;
  note: string;
  actorId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    itemName: { type: String, required: true },
    unit: { type: String, default: '' },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, min: 0 },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, default: '' },
    supplier: { type: String, default: '' },
    note: { type: String, default: '' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ createdAt: -1 });
StockMovementSchema.index({ item: 1, createdAt: -1 });
StockMovementSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
