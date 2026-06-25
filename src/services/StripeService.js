import Stripe from 'stripe';

class StripeService {
  constructor() {
    this.stripe = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;
  }

  async createPaymentIntent(amount, currency = 'usd', orderId) {
    console.log(`[StripeService] Creating Payment Intent for Order ${orderId}, Amount: ${amount} ${currency}`);
    if (!this.stripe) {
      console.log('[StripeService] Stripe is in MOCK mode. Returning simulated payment client secret.');
      return {
        id: `pi_mock_${Math.random().toString(36).substring(2, 15)}`,
        clientSecret: `pi_mock_secret_${Math.random().toString(36).substring(2, 15)}`,
        amount,
        status: 'requires_payment_method'
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects cents
        currency: currency.toLowerCase(),
        metadata: { orderId }
      });
      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('[StripeService] Error creating Payment Intent:', error.message);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  verifyWebhookSignature(payload, signature) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_mock')) {
      console.log('[StripeService] Webhook validation bypassed in mock mode.');
      return JSON.parse(payload);
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error('[StripeService] Webhook Signature Verification Failed:', error.message);
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }
}

export default new StripeService();
