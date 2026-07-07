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
 * Create Stripe Payment Intent BEFORE order creation
 * This is the first step - client calls this to get a payment intent
 * Order is only created after successful payment
 */
export const createStripePaymentIntent = async (req, res, next) => {
  const { amount, currency = 'usd', orderData } = req.body;

  try {
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    // Validate order data exists
    if (!orderData || !orderData.orderItems || orderData.orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order data is required'
      });
    }

    // Verify inventory availability before creating payment intent
    for (const item of orderData.orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.product} not found`
        });
      }
      if (product.inventory < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory for ${product.title}. Available: ${product.inventory}`
        });
      }
    }

    // Create payment intent with order data in metadata
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      currency,
      null, // No orderId yet - will be added after payment
      {
        metadata: {
          userId: req.user._id.toString(),
          orderData: JSON.stringify({
            ...orderData,
            userId: req.user._id.toString()
          })
        }
      }
    );

    // Store payment intent in a temporary collection or cache
    // For simplicity, we'll return it and the client will send it back
    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount
    });
  } catch (error) {
    console.error('[PaymentController] Error creating payment intent:', error.message);
    next(error);
  }
};

/**
 * Confirm payment and create order
 * Called after Stripe payment succeeds on the client
 */
export const confirmStripePayment = async (req, res, next) => {
  const { paymentIntentId } = req.body;

  try {
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);

    // Verify payment status
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Status: ${paymentIntent.status}`
      });
    }

    // Check if order already exists for this payment
    const existingPayment = await Payment.findOne({ transactionId: paymentIntentId });
    if (existingPayment) {
      // Order already created, return it
      const existingOrder = await Order.findById(existingPayment.order);
      return res.json({
        success: true,
        message: 'Order already exists',
        order: existingOrder
      });
    }

    // Parse order data from metadata
    let orderData;
    try {
      orderData = JSON.parse(paymentIntent.metadata?.orderData || '{}');
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data in payment metadata'
      });
    }

    // Verify user owns this payment
    if (orderData.userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this payment'
      });
    }

    // Create the order NOW (after payment confirmed)
    const order = await Order.create({
      user: req.user._id,
      orderItems: orderData.orderItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: 'Stripe',
      taxPrice: orderData.taxPrice || 0,
      shippingPrice: orderData.shippingPrice || 0,
      discountPrice: orderData.discountPrice || 0,
      totalPrice: paymentIntent.amount / 100, // Use actual charged amount
      isPaid: true,
      paidAt: new Date(),
      orderStatus: 'Paid',
      paymentResult: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        update_time: new Date().toISOString(),
        email_address: paymentIntent.receipt_email
      }
    });

    // Deduct inventory
    for (const item of orderData.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { inventory: -item.quantity }
      });
    }
    order.inventoryDeducted = true;
    await order.save();

    // Create payment record
    await Payment.create({
      order: order._id,
      transactionId: paymentIntentId,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      gateway: 'Stripe',
      status: 'succeeded',
      rawWebhookPayload: paymentIntent
    });

    console.log(`[PaymentController] Order ${order._id} created after successful Stripe payment`);

    res.json({
      success: true,
      message: 'Payment confirmed and order created',
      order
    });
  } catch (error) {
    console.error('[PaymentController] Error confirming payment:', error.message);
    next(error);
  }
};

/**
 * Setup payment for order (PayPal, Razorpay, or legacy Stripe flow)
 * For Stripe, prefer createStripePaymentIntent instead
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
        // For backwards compatibility, still support this flow
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
    event = stripeService.verifyWebhookSignature(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[PaymentController] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[PaymentController] Received Stripe webhook: ${event.type}`);

  try {
    const result = await stripeService.handleWebhookEvent(event, Order, Payment, Product);
    res.json({ received: true, handled: result.handled });
  } catch (error) {
    console.error('[PaymentController] Error processing webhook:', error.message);
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

    const refund = await stripeService.createRefund(
      paymentIntentId,
      amount || null,
      reason || 'requested_by_customer'
    );

    const refundAmount = refund.amount || order.totalPrice;
    const isFullRefund = refundAmount >= order.totalPrice;

    order.isRefunded = isFullRefund;
    order.refundAmount = refundAmount;
    order.refundedAt = new Date();
    order.orderStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';

    await order.save();

    await Payment.findOneAndUpdate(
      { order: order._id },
      {
        status: isFullRefund ? 'refunded' : 'partially_refunded',
        refundAmount,
        refundedAt: new Date()
      }
    );

    if (isFullRefund && order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: item.quantity }
        });
      }
    }

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
  createStripePaymentIntent,
  confirmStripePayment,
  processPayment,
  verifyRazorpayPayment,
  confirmPayPalPayment,
  stripeWebhook,
  processRefund,
  getPaymentDetails
};
