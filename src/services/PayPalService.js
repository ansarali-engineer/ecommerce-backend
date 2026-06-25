import axios from 'axios';

class PayPalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.mode = process.env.PAYPAL_MODE || 'sandbox';
    this.apiBase = this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    this.isMock = !this.clientId || this.clientId.startsWith('mock');
  }

  async getAccessToken() {
    if (this.isMock) return 'mock_access_token';

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    try {
      const response = await axios.post(
        `${this.apiBase}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return response.data.access_token;
    } catch (error) {
      console.error('[PayPalService] Error fetching access token:', error.response?.data || error.message);
      throw new Error(`PayPal auth failure: ${error.message}`);
    }
  }

  async createOrder(amount, currency = 'USD') {
    console.log(`[PayPalService] Creating PayPal Order for amount: ${amount}`);
    if (this.isMock) {
      return {
        id: `PAYPAL-MOCK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: 'CREATED',
        links: [
          { href: `https://www.sandbox.paypal.com/checkoutnow?token=mock_${Math.random().toString(36).substring(2, 10)}`, rel: 'approve', method: 'GET' }
        ]
      };
    }

    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `${this.apiBase}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                value: amount.toFixed(2)
              }
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('[PayPalService] Error creating order:', error.response?.data || error.message);
      throw new Error(`PayPal order creation failed: ${error.message}`);
    }
  }

  async captureOrder(paypalOrderId) {
    console.log(`[PayPalService] Capturing Order: ${paypalOrderId}`);
    if (this.isMock || paypalOrderId.startsWith('PAYPAL-MOCK-')) {
      return {
        id: paypalOrderId,
        status: 'COMPLETED',
        payer: { email_address: 'guest-payer@sandbox.paypal.com' }
      };
    }

    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `${this.apiBase}/v2/checkout/orders/${paypalOrderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('[PayPalService] Error capturing order:', error.response?.data || error.message);
      throw new Error(`PayPal capture failed: ${error.message}`);
    }
  }
}

export default new PayPalService();
