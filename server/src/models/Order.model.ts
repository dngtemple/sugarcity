import mongoose, { Document, Schema } from 'mongoose';

// pending   = New (just placed, not yet looked at)
// confirmed = Confirmed with the customer
// ready     = Ready for pickup / delivery
// delivered = Completed (picked up or delivered)
// cancelled = Cancelled
export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'ready', 'delivered', 'cancelled'];

/** Statuses still being worked on — the columns of the admin board. */
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'ready'];

// Payment is recorded by hand — there is no gateway. Orders are paid in full
// or not at all, so this is a two-state flag: staff mark it paid once the
// MoMo/bank transfer lands or cash is taken at the counter.
export type PaymentStatus = 'unpaid' | 'paid';

export const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'paid'];

export type OrderType = 'pickup' | 'delivery';

export interface IOrderItemOption {
  group: string;
  name: string;
  price: number;
}

export interface IOrderItem {
  menuItemId?: mongoose.Types.ObjectId;
  name: string;
  /** cakes / pastries / gifts; empty for off-menu items typed in at the counter. */
  section: string;
  category: string;
  /** Unit price: base price plus every chosen option. */
  price: number;
  quantity: number;
  options: IOrderItemOption[];
  /** Message to write on the cake or box. */
  message: string;
}

export interface IOrderGift {
  recipientName: string;
  recipientPhone: string;
  /** Written on the gift card. */
  message: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  /** Idempotency key from the website, so a retried submit can't double-book. */
  clientRef?: string;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  items: IOrderItem[];
  deliveryDate?: Date;
  deliveryTime: string;
  /** Delivery address (the recipient's, for a gift). Empty for pickup. */
  deliveryLocation: string;
  landmark: string;
  notes: string;
  /** Set when the order is a gift for someone else (e.g. a gift box). */
  gift?: IOrderGift;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paidAt?: Date | null;
  paymentNote?: string;
  isWalkIn: boolean;
  statusHistory: { status: OrderStatus; timestamp: Date; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemOptionSchema = new Schema<IOrderItemOption>(
  {
    group: { type: String, default: '' },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const OrderItemSchema = new Schema<IOrderItem>({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  section: { type: String, default: '' },
  category: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  options: { type: [OrderItemOptionSchema], default: [] },
  message: { type: String, default: '' },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    clientRef: { type: String },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    orderType: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
    items: { type: [OrderItemSchema], required: true },
    deliveryDate: { type: Date },
    deliveryTime: { type: String, default: '' },
    deliveryLocation: { type: String, default: '' },
    landmark: { type: String, default: '' },
    notes: { type: String, default: '' },
    gift: {
      type: new Schema<IOrderGift>(
        {
          recipientName: { type: String, required: true },
          recipientPhone: { type: String, default: '' },
          message: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: undefined,
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    paidAt: { type: Date, default: null },
    paymentNote: { type: String, default: '' },
    isWalkIn: { type: Boolean, default: false },
    statusHistory: [
      {
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, deliveryDate: 1 });
OrderSchema.index({ clientRef: 1 }, { unique: true, partialFilterExpression: { clientRef: { $type: 'string' } } });

export default mongoose.model<IOrder>('Order', OrderSchema);
