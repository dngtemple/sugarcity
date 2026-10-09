import mongoose, { Document, Schema, Types } from 'mongoose';
import { SECTIONS, type Section } from '../config/sections';

export interface IMenuOption {
  _id: Types.ObjectId;
  name: string;
  /** Added to the item's base price when this option is chosen. */
  price: number;
}

export interface IOptionGroup {
  _id: Types.ObjectId;
  /** Shown to the customer, e.g. "Size", "Flavour", "Extras". */
  name: string;
  /** The customer must pick at least one option before adding to the bag. */
  required: boolean;
  /** The customer may pick several options (checkboxes instead of radios). */
  multiple: boolean;
  options: IMenuOption[];
}

export interface IMenuItem extends Document {
  /** Cakes, Pastries & Treats or Gift Boxes. */
  section: Section;
  category: string;
  name: string;
  description: string;
  /** Base price. Chosen option prices are added on top. */
  price: number;
  available: boolean;
  popular: boolean;
  /** Lets the customer type a message for the cake or box. */
  allowMessage: boolean;
  /** Fewest a customer can order, e.g. 10 for meat pies sold by the piece. */
  minQuantity: number;
  /** Usually sent to someone else (gift boxes): checkout starts with the gift details open. */
  isGift: boolean;
  image: string;
  optionGroups: IOptionGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const MenuOptionSchema = new Schema<IMenuOption>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0, min: 0 },
});

const OptionGroupSchema = new Schema<IOptionGroup>({
  name: { type: String, required: true, trim: true },
  required: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false },
  options: { type: [MenuOptionSchema], default: [] },
});

const MenuItemSchema = new Schema<IMenuItem>(
  {
    section: { type: String, enum: SECTIONS, default: 'cakes' },
    category: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    allowMessage: { type: Boolean, default: false },
    minQuantity: { type: Number, default: 1, min: 1, max: 1000 },
    isGift: { type: Boolean, default: false },
    image: { type: String, default: '' },
    optionGroups: { type: [OptionGroupSchema], default: [] },
  },
  { timestamps: true }
);

// The public menu reads only available items, sorted by category and name.
MenuItemSchema.index({ available: 1, category: 1, name: 1 });

export default mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
