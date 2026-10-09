import mongoose, { Schema } from 'mongoose';

// Atomic sequence counters (e.g. short, readable order numbers).
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', CounterSchema);

/** Returns the next value of `name`, starting after `start`. One round-trip. */
export async function nextSequence(name: string, start = 1000): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    [{ $set: { seq: { $add: [{ $ifNull: ['$seq', start] }, 1] } } }],
    { new: true, upsert: true, lean: true }
  );
  return (doc as unknown as { seq: number }).seq;
}

export default Counter;
