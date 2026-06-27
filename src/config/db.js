import mongoose from 'mongoose';

// Cache connection across serverless function invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,      // Don't buffer commands if disconnected
      maxPoolSize: 10,            // Limit connections per function instance
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, opts)
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