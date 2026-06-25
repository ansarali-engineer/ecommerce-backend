import express from 'express';
import FlashSale from '../models/FlashSale.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes

// Get active flash sales
router.get('/active', async (req, res, next) => {
  try {
    const now = new Date();
    const flashSales = await FlashSale.find({
      status: 'active',
      startTime: { $lte: now },
      endTime: { $gte: now }
    })
    .populate('products.product', 'title images price slug')
    .sort({ createdAt: -1 });

    res.json({ success: true, flashSales });
  } catch (error) {
    next(error);
  }
});

// Get upcoming flash sales
router.get('/upcoming', async (req, res, next) => {
  try {
    const now = new Date();
    const flashSales = await FlashSale.find({
      status: 'scheduled',
      startTime: { $gt: now }
    })
    .populate('products.product', 'title images price slug')
    .sort({ startTime: 1 });

    res.json({ success: true, flashSales });
  } catch (error) {
    next(error);
  }
});

// Get flash sale by ID
router.get('/:id', async (req, res, next) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id)
      .populate('products.product', 'title images price slug description');

    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    res.json({ success: true, flashSale });
  } catch (error) {
    next(error);
  }
});

// Protected admin routes
router.use(protect, admin);

// Create flash sale
router.post('/', async (req, res, next) => {
  try {
    const flashSale = await FlashSale.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Flash sale created successfully',
      flashSale
    });
  } catch (error) {
    next(error);
  }
});

// Update flash sale
router.put('/:id', async (req, res, next) => {
  try {
    const flashSale = await FlashSale.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    res.json({ success: true, flashSale });
  } catch (error) {
    next(error);
  }
});

// Delete flash sale
router.delete('/:id', async (req, res, next) => {
  try {
    const flashSale = await FlashSale.findByIdAndDelete(req.params.id);

    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    res.json({ success: true, message: 'Flash sale deleted' });
  } catch (error) {
    next(error);
  }
});

// Get all flash sales (admin)
router.get('/admin/all', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const flashSales = await FlashSale.find(query)
      .populate('products.product', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FlashSale.countDocuments(query);

    res.json({
      success: true,
      flashSales,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update flash sale status
router.put('/:id/status', async (req, res, next) => {
  const { status } = req.body;

  try {
    const flashSale = await FlashSale.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!flashSale) {
      return res.status(404).json({
        success: false,
        message: 'Flash sale not found'
      });
    }

    res.json({ success: true, flashSale });
  } catch (error) {
    next(error);
  }
});

export default router;
