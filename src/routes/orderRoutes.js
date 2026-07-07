import express from 'express';
import {
  createOrder,
  getOrderById,
  getMyOrders,
  cancelOrder,
  downloadInvoice
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { orderSchema } from '../validation/schemas.js';

const router = express.Router();

router.use(protect); // All order routes require login

router.route('/')
  .post(validateBody(orderSchema), createOrder)
  .get(getMyOrders);

router.get('/:id/invoice', downloadInvoice);

router.route('/:id')
  .get(getOrderById)
  .put(cancelOrder);

export default router;
