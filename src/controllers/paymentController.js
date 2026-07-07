import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Product from '../models/Product.js';
import stripeService from '../services/StripeService.js';
import paypalService from '../services/PayPalService.js';
import razorpayService from '../services/RazorpayService.js';
import { isOrderOwnerOrAdmin } from '../utils/authHelpers.js';

const authorizeOrderAccess = (order, user, res) => {
  if (!isOrderOwnerOrAdmin(order, user)) {
    res.status(403).json({ success: false, message: 'Not authorized to access this order' });
    return false;
  }
  return true;
};

/**
 * Setup payment for order - Creates payment intent
 */
export const processPayment = async (req, res, next) => {
  const { orderId, gateway } = req.body;

  try {
    // Validate gateway
    if (!['Stripe', 'PayPal', 'Razorpay'].includes(gateway)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment gateway. Supported: Stripe, PayPal, Razorpay' 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!authorizeOrderAccess(order, req.user, res)) return;

    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    if (order.isCancelled) {
      return res.status(400).json({ success: false, message: 'Order has been cancelled' });
    }

    let responseData = {};

    switch (gateway) {
      case 'Stripe': {
        const stripeIntent = await stripeService.createPaymentIntent(
          order.totalPrice,
          'usd',
          order._id.toString()
        );
        responseData = {
          gateway: 'Stripe',
          paymentIntentId: stripeIntent.id,
          clientSecret: stripeIntent.clientSecret,
          amount: stripeIntent.amount,
          currency: stripeIntent.currency
        };
        break;
      }

      case 'PayPal': {
        const paypalOrder = await paypalService.createOrder(order.totalPrice, 'USD');
        responseData = {
          gateway: 'PayPal',
          paypalOrderId: paypalOrder.id,
          links: paypalOrder.links
        };
        break;
      }

      case 'Razorpay': {
        const razorpayOrder = await razorpayService.createOrder(
          order.totalPrice,
          'INR',
          order._id.toString()
        );
        responseData = {
          gateway: 'Razorpay',
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        };
        break;
      }
    }

    res.json({
      success: true,
      message: 'Payment session created successfully',
      ...responseData
    });
  } catch (error) {
    console.error('[PaymentController] Error in processPayment:', error.message);
    next(error);
  }
};

/**
 * Verify and confirm Razorpay payment
 */
export const verifyRazorpayPayment = async (req, res, next) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  try {
    // Validate required fields
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required payment verification fields' 
      });
    }

    const isValid = razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid signature. Payment verification failed.' 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!authorizeOrderAccess(order, req.user, res)) return;

    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    // Update order
    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'Paid';
    order.paymentResult = {
      id: razorpayPaymentId,
      status: 'Captured',
      update_time: new Date().toISOString()
    };

    await order.save();

    // Deduct inventory
    if (!order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: -item.quantity }
        });
      }
      order.inventoryDeducted = true;
      await order.save();
    }

    // Create payment record
    await Payment.create({
      order: order._id,
      transactionId: razorpayPaymentId,
      amount: order.totalPrice,
      currency: 'INR',
      gateway: 'Razorpay',
      status: 'succeeded'
    });

    console.log(`[PaymentController] Razorpay payment verified for order ${orderId}`);

    res.json({ 
      success: true, 
      message: 'Payment verified and order completed successfully', 
      order 
    });
  } catch (error) {
    console.error('[PaymentController] Error in verifyRazorpayPayment:', error.message);
    next(error);
  }
};

/**
 * Confirm PayPal payment capture
 */
export const confirmPayPalPayment = async (req, res, next) => {
  const { orderId, paypalOrderId } = req.body;

  try {
    if (!orderId || !paypalOrderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing orderId or paypalOrderId' 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!authorizeOrderAccess(order, req.user, res)) return;

    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    const capture = await paypalService.captureOrder(paypalOrderId);
    
    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `PayPal order not completed. Status: ${capture.status}`
      });
    }

    // Update order
    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'Paid';
    order.paymentResult = {
      id: capture.id,
      status: capture.status,
      email_address: capture.payer?.email_address,
      update_time: capture.update_time || new Date().toISOString()
    };

    await order.save();

    // Deduct inventory
    if (!order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: -item.quantity }
        });
      }
      order.inventoryDeducted = true;
      await order.save();
    }

    // Create payment record
    await Payment.create({
      order: order._id,
      transactionId: capture.id,
      amount: order.totalPrice,
      currency: 'USD',
      gateway: 'PayPal',
      status: 'succeeded'
    });

    console.log(`[PaymentController] PayPal payment confirmed for order ${orderId}`);

    res.json({ 
      success: true, 
      message: 'PayPal payment confirmed successfully', 
      order 
    });
  } catch (error) {
    console.error('[PaymentController] Error in confirmPayPalPayment:', error.message);
    next(error);
  }
};

/**
 * Stripe Webhook Handler
 * Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, etc.
 */
export const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripeService.verifyWebhookSignature(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[PaymentController] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[PaymentController] Received Stripe webhook: ${event.type}`);

  try {
    // Handle the event
    const result = await stripeService.handleWebhookEvent(event, Order, Payment, Product);

    if (result.handled) {
      console.log(`[PaymentController] Successfully processed webhook: ${event.type}`);
    } else {
      console.log(`[PaymentController] Webhook not fully processed: ${event.type}`, result.error || '');
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true, handled: result.handled });
  } catch (error) {
    console.error('[PaymentController] Error processing webhook:', error.message);
    
    // Still return 200 to prevent Stripe from retrying
    // Log the error for investigation
    res.json({ received: true, handled: false, error: error.message });
  }
};

/**
 * Process refund for an order
 */
export const processRefund = async (req, res, next) => {
  const { orderId } = req.params;
  const { amount, reason } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is not paid yet' });
    }

    if (order.isRefunded) {
      return res.status(400).json({ success: false, message: 'Order is already refunded' });
    }

    // Only Stripe refunds are supported via this endpoint
    if (order.paymentMethod !== 'Stripe') {
      return res.status(400).json({ 
        success: false, 
        message: 'Refunds only supported for Stripe payments' 
      });
    }

    const paymentIntentId = order.paymentResult?.id;
    if (!paymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'No payment intent found for this order' 
      });
    }

    // Process refund through Stripe
    const refund = await stripeService.createRefund(
      paymentIntentId,
      amount || null, // Null for full refund
      reason || 'requested_by_customer'
    );

    // Update order
    const refundAmount = refund.amount || order.totalPrice;
    const isFullRefund = refundAmount >= order.totalPrice;

    order.isRefunded = isFullRefund;
    order.refundAmount = refundAmount;
    order.refundedAt = new Date();
    order.orderStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';

    await order.save();

    // Update payment record
    await Payment.findOneAndUpdate(
      { order: order._id },
      { 
        status: isFullRefund ? 'refunded' : 'partially_refunded',
        refundAmount,
        refundedAt: new Date()
      }
    );

    // Restore inventory for full refunds
    if (isFullRefund && order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: item.quantity }
        });
      }
    }

    console.log(`[PaymentController] Refund processed for order ${orderId}`);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refundAmount,
        status: refund.status
      },
      order
    });
  } catch (error) {
    console.error('[PaymentController] Error processing refund:', error.message);
    next(error);
  }
};

/**
 * Get payment details for an order
 */
export const getPaymentDetails = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!authorizeOrderAccess(order, req.user, res)) return;

    const payment = await Payment.findOne({ order: orderId });

    res.json({
      success: true,
      payment: payment || null,
      orderPaymentInfo: {
        method: order.paymentMethod,
        isPaid: order.isPaid,
        paidAt: order.paidAt,
        isRefunded: order.isRefunded,
        refundAmount: order.refundAmount,
        paymentResult: order.paymentResult
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  processPayment,
  verifyRazorpayPayment,
  confirmPayPalPayment,
  stripeWebhook,
  processRefund,
  getPaymentDetails
};
