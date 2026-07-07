import request from 'supertest';
import app from '../app.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import ReturnRequest from '../models/Return.js';

describe('Refund / Return API', () => {
  let userToken;
  let userId;
  let adminToken;
  let testProduct;
  let deliveredOrder;

  const createDeliveredOrder = async (overrides = {}) => {
    return Order.create({
      user: userId,
      orderItems: [{
        product: testProduct._id,
        title: testProduct.title,
        quantity: 2,
        image: testProduct.images[0].url,
        price: testProduct.price
      }],
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US'
      },
      paymentMethod: 'CashOnDelivery',
      isPaid: true,
      isDelivered: true,
      deliveredAt: new Date(),
      orderStatus: 'Delivered',
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: testProduct.price * 2,
      ...overrides
    });
  };

  beforeEach(async () => {
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Refund User',
        email: 'refund@example.com',
        password: 'RefundPass123'
      });

    userToken = userResponse.body.token;
    userId = userResponse.body.user._id;

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Refund Admin',
        email: 'refundadmin@example.com',
        password: 'AdminPass123'
      });

    await User.findByIdAndUpdate(adminResponse.body.user._id, { role: 'admin' });
    adminToken = adminResponse.body.token;

    const category = await Category.create({
      name: 'Refund Category',
      slug: 'refund-category'
    });

    testProduct = await Product.create({
      title: 'Refund Test Product',
      slug: 'refund-test-product',
      description: 'Product for refund tests',
      price: 25.00,
      category: category._id,
      inventory: 50,
      images: [{ url: 'https://example.com/image.jpg', isPrimary: true }],
      status: 'active'
    });

    deliveredOrder = await createDeliveredOrder();
  });

  describe('ReturnRequest model', () => {
    it('generates an RF- prefixed return number automatically', async () => {
      const returnRequest = await ReturnRequest.create({
        order: deliveredOrder._id,
        user: userId,
        returnReason: 'damaged',
        items: [{ product: testProduct._id, quantity: 1 }]
      });

      expect(returnRequest.returnNumber).toMatch(/^RF-/);
    });
  });

  describe('GET /api/returns/eligibility/:orderId', () => {
    it('returns eligible for delivered order', async () => {
      const response = await request(app)
        .get(`/api/returns/eligibility/${deliveredOrder._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.eligibility.eligible).toBe(true);
      expect(response.body.eligibility.refundableItems[0].maxRefundable).toBe(2);
    });

    it('rejects non-delivered orders', async () => {
      const pendingOrder = await createDeliveredOrder({
        isDelivered: false,
        orderStatus: 'Processing',
        deliveredAt: null
      });

      const response = await request(app)
        .get(`/api/returns/eligibility/${pendingOrder._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.eligibility.eligible).toBe(false);
    });
  });

  describe('POST /api/returns', () => {
    it('creates a refund request for delivered order', async () => {
      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          returnReasonDetails: 'Box was crushed',
          refundType: 'original_payment',
          items: [{ product: testProduct._id.toString(), quantity: 1 }]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.returnRequest.status).toBe('pending');
      expect(response.body.returnRequest.refundAmount).toBe(25);
    });

    it('prevents duplicate active refund for same quantity', async () => {
      await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          items: [{ product: testProduct._id.toString(), quantity: 2 }]
        })
        .expect(201);

      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'defective',
          items: [{ product: testProduct._id.toString(), quantity: 1 }]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('rejects refund quantity exceeding purchased quantity', async () => {
      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          items: [{ product: testProduct._id.toString(), quantity: 5 }]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/returns/:id/cancel', () => {
    it('allows user to cancel pending refund', async () => {
      const createRes = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          items: [{ product: testProduct._id.toString(), quantity: 1 }]
        });

      const returnId = createRes.body.returnRequest._id;

      const response = await request(app)
        .put(`/api/returns/${returnId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.returnRequest.status).toBe('cancelled');
    });
  });

  describe('Admin refund workflow', () => {
    let returnId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          items: [{ product: testProduct._id.toString(), quantity: 2 }]
        });

      returnId = createRes.body.returnRequest._id;
    });

    it('admin can approve and process full refund', async () => {
      await request(app)
        .put(`/api/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerFacingNote: 'Approved for refund' })
        .expect(200);

      const refundRes = await request(app)
        .put(`/api/returns/${returnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ refundAmount: 50 })
        .expect(200);

      expect(refundRes.body.returnRequest.status).toBe('refunded');
      expect(refundRes.body.returnRequest.approvedRefundAmount).toBe(50);
    });

    it('admin can process partial refund', async () => {
      await request(app)
        .put(`/api/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      const refundRes = await request(app)
        .put(`/api/returns/${returnId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ refundAmount: 25 })
        .expect(200);

      expect(refundRes.body.returnRequest.isPartialRefund).toBe(true);
      expect(refundRes.body.returnRequest.approvedRefundAmount).toBe(25);
    });

    it('admin can reject refund', async () => {
      const response = await request(app)
        .put(`/api/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customerFacingNote: 'Outside policy' })
        .expect(200);

      expect(response.body.returnRequest.status).toBe('rejected');
    });

    it('lists refunds for admin with search', async () => {
      const response = await request(app)
        .get('/api/returns/admin/all?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.returns.length).toBeGreaterThan(0);
    });
  });

  describe('Authorization', () => {
    it('prevents other users from viewing refund details', async () => {
      const createRes = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderId: deliveredOrder._id,
          returnReason: 'damaged',
          items: [{ product: testProduct._id.toString(), quantity: 1 }]
        });

      const otherUser = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Other User',
          email: 'other@example.com',
          password: 'OtherPass123'
        });

      await request(app)
        .get(`/api/returns/${createRes.body.returnRequest._id}`)
        .set('Authorization', `Bearer ${otherUser.body.token}`)
        .expect(403);
    });
  });
});
