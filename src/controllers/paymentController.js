import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Product from '../models/Product.js';
import stripeService from '../services/StripeService.js';
import paypalService from '../services/PayPalService.js';
import razorpayService from '../services/RazorpayService.js';

// Setup payment for order
export const processPayment = async (req, res, next) => {
  const { orderId, gateway } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.isPaid) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    let responseData = {};

    switch (gateway) {
      case 'Stripe':
        const stripeIntent = await stripeService.createPaymentIntent(order.totalPrice, 'usd', order._id.toString());
        responseData = {
          gateway: 'Stripe',
          paymentIntentId: stripeIntent.id,
          clientSecret: stripeIntent.clientSecret,
          amount: stripeIntent.amount
        };
        break;

      case 'PayPal':
        const paypalOrder = await paypalService.createOrder(order.totalPrice, 'USD');
        responseData = {
          gateway: 'PayPal',
          paypalOrderId: paypalOrder.id,
          links: paypalOrder.links
        };
        break;

      case 'Razorpay':
        const razorpayOrder = await razorpayService.createOrder(order.totalPrice, 'INR', order._id.toString());
        responseData = {
          gateway: 'Razorpay',
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        };
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid payment gateway selected' });
    }

    res.json({
      success: true,
      ...responseData
    });
  } catch (error) {
    next(error);
  }
};

// Confirm Razorpay Payment Signature
export const verifyRazorpayPayment = async (req, res, next) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  try {
    const isValid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid signature. Payment verification failed.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order status
    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'Paid';
    order.paymentResult = {
      id: razorpayPaymentId,
      status: 'Captured',
      update_time: new Date().toISOString()
    };

    await order.save();

    // Deduct stock levels
    // Deduct stock levels only if not already deducted at order creation
    if (!order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: -item.quantity }
        });
      }
      order.inventoryDeducted = true;
      await order.save();
    }

    // Record Payment
    await Payment.create({
      order: order._id,
      transactionId: razorpayPaymentId,
      amount: order.totalPrice,
      currency: 'INR',
      gateway: 'Razorpay',
      status: 'succeeded'
    });

    res.json({ success: true, message: 'Payment verified and order completed successfully', order });
  } catch (error) {
    next(error);
  }
};

// Confirm PayPal Payment Capture
export const confirmPayPalPayment = async (req, res, next) => {
  const { orderId, paypalOrderId } = req.body;

  try {
    const capture = await paypalService.captureOrder(paypalOrderId);
    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: `PayPal order not completed. Status: ${capture.status}` });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

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

    // Deduct stock levels
      // Deduct stock levels only if not already deducted at order creation
      if (!order.inventoryDeducted) {
        for (const item of order.orderItems) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { inventory: -item.quantity }
          });
        }
        order.inventoryDeducted = true;
        await order.save();
      }

    // Record Payment
    await Payment.create({
      order: order._id,
      transactionId: capture.id,
      amount: order.totalPrice,
      currency: 'USD',
      gateway: 'PayPal',
      status: 'succeeded'
    });

    res.json({ success: true, message: 'PayPal payment confirmed successfully', order });
  } catch (error) {
    next(error);
  }
};

// Stripe Webhook Receiver
export const stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Note: Stripe webhook needs the raw body to verify signature. We will handle that in app.js setup.
    event = stripeService.verifyWebhookSignature(req.body, sig);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata.orderId;

    try {
      const order = await Order.findById(orderId);
      if (order && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.orderStatus = 'Paid';
        order.paymentResult = {
          id: paymentIntent.id,
          status: paymentIntent.status,
          update_time: new Date().toISOString()
        };

        await order.save();

        // Deduct stock levels
          // Deduct stock levels only if not already deducted at order creation
          if (!order.inventoryDeducted) {
            for (const item of order.orderItems) {
              await Product.findByIdAndUpdate(item.product, {
                $inc: { inventory: -item.quantity }
              });
            }
            order.inventoryDeducted = true;
            await order.save();
          }

        // Record payment
        await Payment.create({
          order: order._id,
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Cents to Dollars
          currency: paymentIntent.currency.toUpperCase(),
          gateway: 'Stripe',
          status: 'succeeded',
          rawWebhookPayload: paymentIntent
        });

        console.log(`[Stripe Webhook] Order ${orderId} successfully marked as PAID.`);
      }
    } catch (error) {
      console.error('[Stripe Webhook] Error updating order:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  res.json({ received: true });
};
