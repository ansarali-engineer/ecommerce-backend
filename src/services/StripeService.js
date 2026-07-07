import Stripe from 'stripe';

class StripeService {
  constructor() {
    this.stripe = null;
    this.isInitialized = false;
    
    // Only initialize Stripe if we have a valid secret key
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')) {
      try {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2023-10-16',
          typescript: false,
        });
        this.isInitialized = true;
        console.log('[StripeService] Initialized successfully');
      } catch (error) {
        console.error('[StripeService] Failed to initialize:', error.message);
      }
    } else {
      console.log('[StripeService] Running in MOCK mode - Stripe not configured');
    }
  }

  /**
   * Create a PaymentIntent for a payment
   * @param {number} amount - Amount in dollars (will be converted to cents)
   * @param {string} currency - Currency code (e.g., 'usd')
   * @param {string} orderId - Order ID for metadata
   * @param {object} options - Additional options
   */
  async createPaymentIntent(amount, currency = 'usd', orderId, options = {}) {
    console.log(`[StripeService] Creating PaymentIntent for Order ${orderId}, Amount: ${amount} ${currency.toUpperCase()}`);
    
    // Mock mode - return simulated response
    if (!this.stripe) {
      console.log('[StripeService] MOCK MODE: Returning simulated PaymentIntent');
      return {
        id: `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(2, 15)}`,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        status: 'requires_payment_method',
        metadata: { orderId }
      };
    }

    try {
      const amountInCents = Math.round(amount * 100);
      
      // Validate amount
      if (amountInCents < 50) {
        throw new Error('Amount must be at least $0.50 USD');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          orderId,
          environment: process.env.NODE_ENV || 'development',
          ...options.metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
        // Capture payment immediately
        capture_method: 'automatic',
        // Enable 3D Secure if needed
        payment_method_options: {
          card: {
            request_three_d_secure: 'automatic'
          }
        }
      });

      console.log(`[StripeService] PaymentIntent created: ${paymentIntent.id}`);

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountInCents / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata
      };
    } catch (error) {
      console.error('[StripeService] Error creating PaymentIntent:', error.message);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.type === 'StripeInvalidRequestError') {
        if (error.message.includes('amount')) {
          errorMessage = 'Invalid payment amount';
        }
      }
      
      throw new Error(`Stripe payment error: ${errorMessage}`);
    }
  }

  /**
   * Retrieve a PaymentIntent by ID
   */
  async retrievePaymentIntent(paymentIntentId) {
    if (!this.stripe) {
      console.log('[StripeService] MOCK MODE: Retrieving simulated PaymentIntent');
      return {
        id: paymentIntentId,
        status: 'succeeded',
        amount: 0
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('[StripeService] Error retrieving PaymentIntent:', error.message);
      throw new Error(`Failed to retrieve payment: ${error.message}`);
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentIntentId, amount = null, reason = null) {
    if (!this.stripe) {
      console.log('[StripeService] MOCK MODE: Simulating refund');
      return {
        id: `re_mock_${Date.now()}`,
        payment_intent: paymentIntentId,
        amount: amount || 0,
        status: 'succeeded'
      };
    }

    try {
      const refundData = {
        payment_intent: paymentIntentId
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Partial refund
      }

      if (reason) {
        refundData.reason = reason; // 'duplicate', 'fraudulent', 'requested_by_customer'
      }

      const refund = await this.stripe.refunds.create(refundData);

      console.log(`[StripeService] Refund created: ${refund.id}`);

      return {
        id: refund.id,
        paymentIntentId: refund.payment_intent,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason
      };
    } catch (error) {
      console.error('[StripeService] Error creating refund:', error.message);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, webhookSecret = null) {
    const secret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    // Mock mode
    if (!this.stripe || !secret || secret.startsWith('whsec_mock')) {
      console.log('[StripeService] MOCK MODE: Bypassing webhook signature verification');
      
      // Parse the payload if it's a string
      if (typeof payload === 'string') {
        try {
          return JSON.parse(payload);
        } catch {
          throw new Error('Invalid webhook payload');
        }
      }
      return payload;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        secret
      );
      console.log(`[StripeService] Webhook verified: ${event.type}`);
      return event;
    } catch (error) {
      console.error('[StripeService] Webhook signature verification failed:', error.message);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Construct webhook event (alias for verifyWebhookSignature)
   */
  constructEvent(payload, signature, secret) {
    return this.verifyWebhookSignature(payload, signature, secret);
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event, Order, Payment, Product) {
    const { type, data } = event;
    const object = data.object;

    console.log(`[StripeService] Processing webhook event: ${type}`);

    switch (type) {
      case 'payment_intent.succeeded':
        return await this.handlePaymentSucceeded(object, Order, Payment, Product);

      case 'payment_intent.payment_failed':
        return await this.handlePaymentFailed(object, Order, Payment);

      case 'charge.refunded':
        return await this.handleRefund(object, Order, Payment);

      case 'charge.refund.updated':
        return await this.handleRefundUpdated(object, Order, Payment);

      case 'payment_intent.canceled':
        return await this.handlePaymentCanceled(object, Order);

      default:
        console.log(`[StripeService] Unhandled webhook event type: ${type}`);
        return { handled: false };
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSucceeded(paymentIntent, Order, Payment, Product) {
    const orderId = paymentIntent.metadata?.orderId;
    
    if (!orderId) {
      console.error('[StripeService] No orderId in payment metadata');
      return { handled: false, error: 'No orderId in metadata' };
    }

    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        console.error(`[StripeService] Order not found: ${orderId}`);
        return { handled: false, error: 'Order not found' };
      }

      if (order.isPaid) {
        console.log(`[StripeService] Order ${orderId} already marked as paid`);
        return { handled: true, alreadyProcessed: true };
      }

      // Update order status
      order.isPaid = true;
      order.paidAt = new Date();
      order.orderStatus = 'Paid';
      order.paymentResult = {
        id: paymentIntent.id,
        status: paymentIntent.status,
        update_time: new Date().toISOString()
      };

      // Deduct inventory if not already done
      if (!order.inventoryDeducted) {
        for (const item of order.orderItems) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { inventory: -item.quantity }
          });
        }
        order.inventoryDeducted = true;
      }

      await order.save();

      // Create payment record
      await Payment.create({
        order: order._id,
        transactionId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        gateway: 'Stripe',
        status: 'succeeded',
        rawWebhookPayload: paymentIntent
      });

      console.log(`[StripeService] Order ${orderId} successfully marked as PAID`);
      return { handled: true, order };
    } catch (error) {
      console.error('[StripeService] Error processing payment success:', error.message);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(paymentIntent, Order, Payment) {
    const orderId = paymentIntent.metadata?.orderId;
    
    if (!orderId) {
      return { handled: false, error: 'No orderId in metadata' };
    }

    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        return { handled: false, error: 'Order not found' };
      }

      // Update order status to failed
      order.orderStatus = 'Failed';
      order.paymentResult = {
        id: paymentIntent.id,
        status: 'failed',
        error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
        update_time: new Date().toISOString()
      };

      await order.save();

      // Create failed payment record
      await Payment.create({
        order: order._id,
        transactionId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        gateway: 'Stripe',
        status: 'failed',
        rawWebhookPayload: paymentIntent
      });

      console.log(`[StripeService] Order ${orderId} marked as FAILED`);
      return { handled: true, order };
    } catch (error) {
      console.error('[StripeService] Error processing payment failure:', error.message);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle refund
   */
  async handleRefund(charge, Order, Payment) {
    const paymentIntentId = charge.payment_intent;
    
    if (!paymentIntentId) {
      return { handled: false, error: 'No payment_intent in charge' };
    }

    try {
      const payment = await Payment.findOne({ transactionId: paymentIntentId }).populate('order');
      
      if (!payment) {
        console.log(`[StripeService] Payment not found for refund: ${paymentIntentId}`);
        return { handled: false, error: 'Payment not found' };
      }

      const order = payment.order;
      
      if (!order) {
        return { handled: false, error: 'Order not found' };
      }

      // Check if this is a full or partial refund
      const refundAmount = charge.amount_refunded / 100;
      const isFullRefund = refundAmount >= order.totalPrice;

      // Update payment status
      payment.status = isFullRefund ? 'refunded' : 'partially_refunded';
      payment.refundAmount = refundAmount;
      payment.refundedAt = new Date();
      await payment.save();

      // Update order status
      order.orderStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';
      order.isRefunded = isFullRefund;
      order.refundAmount = refundAmount;
      order.refundedAt = new Date();
      await order.save();

      console.log(`[StripeService] Order ${order._id} marked as ${isFullRefund ? 'REFUNDED' : 'PARTIALLY REFUNDED'}`);
      return { handled: true, order };
    } catch (error) {
      console.error('[StripeService] Error processing refund:', error.message);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle refund updated
   */
  async handleRefundUpdated(charge, Order, Payment) {
    // Similar to handleRefund but for updates
    return await this.handleRefund(charge, Order, Payment);
  }

  /**
   * Handle canceled payment
   */
  async handlePaymentCanceled(paymentIntent, Order) {
    const orderId = paymentIntent.metadata?.orderId;
    
    if (!orderId) {
      return { handled: false, error: 'No orderId in metadata' };
    }

    try {
      const order = await Order.findById(orderId);
      
      if (!order) {
        return { handled: false, error: 'Order not found' };
      }

      order.orderStatus = 'Cancelled';
      order.paymentResult = {
        id: paymentIntent.id,
        status: 'canceled',
        update_time: new Date().toISOString()
      };

      await order.save();

      console.log(`[StripeService] Order ${orderId} marked as CANCELLED`);
      return { handled: true, order };
    } catch (error) {
      console.error('[StripeService] Error processing payment cancellation:', error.message);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Check if Stripe is properly configured
   */
  isConfigured() {
    return this.isInitialized;
  }
}

export default new StripeService();
