import request from 'supertest';
import app from '../app.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import Cart from '../models/Cart.js';
import mongoose from 'mongoose';

describe('Order Endpoints', () => {
  let userToken;
  let userId;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/ecommerce_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await Cart.deleteMany({});

    // Create user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Order User',
        email: 'order@example.com',
        password: 'OrderPass123'
      });
    
    userToken = userResponse.body.token;
    userId = userResponse.body.user._id;

    // Create category and product
    testCategory = await Category.create({
      name: 'Test Category',
      slug: 'test-category'
    });

    testProduct = await Product.create({
      title: 'Order Test Product',
      slug: 'order-test-product',
      description: 'Test product for orders',
      price: 49.99,
      category: testCategory._id,
      inventory: 100,
      images: ['https://example.com/image.jpg'],
      status: 'active'
    });

    // Add to cart
    await Cart.create({
      user: userId,
      items: [{ product: testProduct._id, quantity: 2 }]
    });
  });

  describe('POST /api/orders', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        orderItems: [{
          product: testProduct._id,
          title: testProduct.title,
          quantity: 2,
          image: testProduct.images[0],
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
        taxPrice: 5.00,
        shippingPrice: 10.00,
        discountPrice: 0,
        totalPrice: 114.98
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.order.orderStatus).toBe('Processing');
      expect(response.body.order.paymentMethod).toBe('CashOnDelivery');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderItems: [],
          shippingAddress: {},
          paymentMethod: 'CashOnDelivery',
          taxPrice: 0,
          shippingPrice: 0,
          totalPrice: 0
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail with insufficient inventory', async () => {
      // Update product inventory to low value
      await Product.findByIdAndUpdate(testProduct._id, { inventory: 1 });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          orderItems: [{
            product: testProduct._id,
            title: testProduct.title,
            quantity: 2,
            image: testProduct.images[0],
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
          taxPrice: 5.00,
          shippingPrice: 10.00,
          totalPrice: 114.98
        })
        .expect(400);

      expect(response.body.message).toContain('Insufficient inventory');
    });
  });

  describe('GET /api/orders/myorders', () => {
    beforeEach(async () => {
      // Create test order
      await Order.create({
        user: userId,
        orderItems: [{
          product: testProduct._id,
          title: testProduct.title,
          quantity: 1,
          image: testProduct.images[0],
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
        taxPrice: 5.00,
        shippingPrice: 10.00,
        totalPrice: 64.99,
        orderStatus: 'Processing'
      });
    });

    it('should return user orders', async () => {
      const response = await request(app)
        .get('/api/orders/myorders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toHaveLength(1);
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    let testOrder;

    beforeEach(async () => {
      testOrder = await Order.create({
        user: userId,
        orderItems: [{
          product: testProduct._id,
          title: testProduct.title,
          quantity: 1,
          image: testProduct.images[0],
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
        taxPrice: 5.00,
        shippingPrice: 10.00,
        totalPrice: 64.99,
        orderStatus: 'Pending'
      });
    });

    it('should cancel pending order', async () => {
      const response = await request(app)
        .put(`/api/orders/${testOrder._id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order.orderStatus).toBe('Cancelled');
    });

    it('should not cancel shipped order', async () => {
      // Update order to shipped
      await Order.findByIdAndUpdate(testOrder._id, { orderStatus: 'Shipped' });

      const response = await request(app)
        .put(`/api/orders/${testOrder._id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
