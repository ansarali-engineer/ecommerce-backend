import connectDB from '../config/db.js';

export const withDB = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({ success: false, message: 'Database unavailable' });
  }
};