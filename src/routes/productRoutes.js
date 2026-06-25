import express from 'express';
import { getProducts, getProductBySlug, createProductReview } from '../controllers/productController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { reviewSchema } from '../validation/schemas.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.post('/:slug/reviews', protect, validateBody(reviewSchema), createProductReview);

export default router;
