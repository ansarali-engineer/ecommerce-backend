import express from 'express';
import {
  createStripePaymentIntent,
  confirmStripePayment,
  processPayment,
  verifyRazorpayPayment,
  confirmPayPalPayment,
  stripeWebhook,
  processRefund,
  getPaymentDetails
} from '../controllers/paymentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/payments/stripe/create-intent
 * @desc    Create Stripe PaymentIntent BEFORE order creation
 * @access  Private
 */
router.post('/stripe/create-intent', protect, createStripePaymentIntent);

/**
 * @route   POST /api/payments/stripe/confirm
 * @desc    Confirm Stripe payment and create order AFTER payment succeeds
 * @access  Private
 */
router.post('/stripe/confirm', protect, confirmStripePayment);

/**
 * @route   POST /api/payments/process
 * @desc    Create payment session/intent for an order (PayPal, Razorpay, or legacy Stripe)
 * @access  Private
 */
router.post('/process', protect, processPayment);

/**
 * @route   POST /api/payments/verify-razorpay
 * @desc    Verify and confirm Razorpay payment
 * @access  Private
 */
router.post('/verify-razorpay', protect, verifyRazorpayPayment);

/**
 * @route   POST /api/payments/confirm-paypal
 * @desc    Confirm PayPal payment capture
 * @access  Private
 */
router.post('/confirm-paypal', protect, confirmPayPalPayment);

/**
 * @route   POST /api/payments/stripe-webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (verified via signature)
 */
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);

/**
 * @route   POST /api/payments/refund/:orderId
 * @desc    Process refund for an order (Admin only)
 * @access  Private/Admin
 */
router.post('/refund/:orderId', protect, admin, processRefund);

/**
 * @route   GET /api/payments/order/:orderId
 * @desc    Get payment details for an order
 * @access  Private
 */
router.get('/order/:orderId', protect, getPaymentDetails);

export default router;
