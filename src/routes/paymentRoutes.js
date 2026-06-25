import express from 'express';
import {
  processPayment,
  verifyRazorpayPayment,
  confirmPayPalPayment,
  stripeWebhook
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/process', protect, processPayment);
router.post('/verify-razorpay', protect, verifyRazorpayPayment);
router.post('/confirm-paypal', protect, confirmPayPalPayment);
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;
