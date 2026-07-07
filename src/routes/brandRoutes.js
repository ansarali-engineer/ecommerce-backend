import express from 'express';
import Brand from '../models/Brand.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes

// Get all brands
router.get('/', async (req, res, next) => {
  try {
    const brands = await Brand.find({ isActive: true })
      .sort({ name: 1 });

    res.json({ success: true, brands });
  } catch (error) {
    next(error);
  }
});

// Admin: get all brands (including inactive) — must be before /:slug
router.get('/admin/all', protect, admin, async (req, res, next) => {
  try {
    const brands = await Brand.find()
      .sort({ name: 1 });

    res.json({ success: true, brands });
  } catch (error) {
    next(error);
  }
});

// Get brand by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const brand = await Brand.findOne({
      slug: req.params.slug,
      isActive: true
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(protect, admin);

// Create brand
router.post('/', async (req, res, next) => {
  try {
    const { name, description, logo, website, metaTitle, metaDescription, isFeatured } = req.body;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const brand = await Brand.create({
      name,
      slug,
      description,
      logo,
      website,
      metaTitle,
      metaDescription,
      isFeatured
    });

    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      brand
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Brand with this name already exists'
      });
    }
    next(error);
  }
});

// Update brand
router.put('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({ success: true, brand });
  } catch (error) {
    next(error);
  }
});

// Delete brand
router.delete('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
