import mongoose from 'mongoose';

// Cache connection across serverless function invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const mongoUri = process.env.NODE_ENV === 'test'
      ? (process.env.MONGO_URI_TEST || process.env.MONGO_URI)
      : process.env.MONGO_URI;

    const opts = {
      bufferCommands: false,      // Don't buffer commands if disconnected
      maxPoolSize: 10,            // Limit connections per function instance
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(mongoUri, opts)
      .then((mongoose) => {
        console.log(`[Database] MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null; // Reset so next call retries
    console.error(`[Database Error] ${error.message}`);
    throw error; // Let the route handler return a 500, don't kill the process
  }

  return cached.conn;
};

export default connectDB;