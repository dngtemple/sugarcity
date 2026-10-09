import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI!;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('[startup] Failed to connect to MongoDB:', (err as Error).message);
    process.exit(1);
  }
};
