import Razorpay from 'razorpay';
import crypto from 'crypto';

class RazorpayService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.isMock = !this.keyId || this.keyId.startsWith('rzp_test_mock');
    
    this.razorpay = !this.isMock
      ? new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret
        })
      : null;
  }

  async createOrder(amount, currency = 'INR', receiptId) {
    console.log(`[RazorpayService] Creating order. Amount: ${amount} ${currency}, Receipt: ${receiptId}`);
    if (this.isMock) {
      return {
        id: `order_mock_${Math.random().toString(36).substring(2, 12)}`,
        amount: Math.round(amount * 100),
        currency,
        receipt: receiptId,
        status: 'created'
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Razorpay expects paisa/cents
        currency,
        receipt: receiptId
      });
      return order;
    } catch (error) {
      console.error('[RazorpayService] Error creating order:', error.message);
      throw new Error(`Razorpay error: ${error.message}`);
    }
  }

  verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    if (this.isMock) {
      console.log('[RazorpayService] Bypassing signature validation in mock mode.');
      return true;
    }

    try {
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body.toString())
        .digest('hex');
      
      return expectedSignature === razorpaySignature;
    } catch (error) {
      console.error('[RazorpayService] Signature verification failed:', error.message);
      return false;
    }
  }
}

export default new RazorpayService();
