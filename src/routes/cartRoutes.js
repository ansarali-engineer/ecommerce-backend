import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  mergeCart
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // protect all cart endpoints

router.route('/')
  .get(getCart)
  .post(addToCart)
  .put(updateCartItemQuantity);

router.delete('/:productId', removeFromCart);
router.post('/merge', mergeCart);

export default router;
