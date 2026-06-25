import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // protect all wishlist endpoints

router.route('/')
  .get(getWishlist)
  .post(addToWishlist);

router.delete('/:productId', removeFromWishlist);
router.post('/move-to-cart', moveToCart);

export default router;
