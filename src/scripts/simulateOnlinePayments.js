import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

import * as orderController from '../controllers/orderController.js';
import * as paymentController from '../controllers/paymentController.js';

import paypalService from '../services/PayPalService.js';
import razorpayService from '../services/RazorpayService.js';
import stripeService from '../services/StripeService.js';

async function ensureUser() {
  let user = await User.findOne({ email: 'paytest@example.com' });
  if (!user) user = await User.create({ name: 'Pay Tester', email: 'paytest@example.com', password: 'PayTest123' });
  return user;
}

async function ensureProduct() {
  let p = await Product.findOne();
  if (!p) p = await Product.create({ title: 'PaySim Product', description: 'For payment simulations', price: 10, inventory: 10, images: [{ url: 'https://via.placeholder.com/150' }] });
  return p;
}

const makeReqRes = (body, user) => {
  const req = { body, user };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(obj) { console.log('RESP:', obj); }
  };
  return { req, res };
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce');
  const user = await ensureUser();
  const product = await ensureProduct();

  console.log('\n--- PayPal Flow ---');
  console.log('Inventory start:', product.inventory);

  // Monkey-patch PayPal capture
  paypalService.captureOrder = async (paypalOrderId) => ({ status: 'COMPLETED', id: 'pp_cap_' + Math.random().toString(36).slice(2), payer: { email_address: user.email }, update_time: new Date().toISOString() });

  // Create order (should deduct inventory once)
  const orderBody = {
    orderItems: [{ product: product._id, title: product.title, quantity: 1, image: product.images?.[0]?.url || '', price: product.price }],
    shippingAddress: { street: '1', city: 'A', state: 'S', zipCode: '000', country: 'Nowhere' },
    paymentMethod: 'PayPal', taxPrice: 0, shippingPrice: 0, discountPrice: 0, totalPrice: product.price
  };
  let { req, res } = makeReqRes(orderBody, user);
  await orderController.createOrder(req, res, (e) => console.error(e));

  const afterCreate = await Product.findById(product._id);
  console.log('Inventory after create:', afterCreate.inventory);

  // Call confirmPayPalPayment (should not double-deduct)
  const payReq = { body: { orderId: (await Order.findOne({ user: user._id }))._id, paypalOrderId: 'mock' }, user };
  const payRes = { status(code) { this.statusCode = code; return this; }, json(obj) { console.log('PayPal confirm resp:', obj.message || obj); } };
  await paymentController.confirmPayPalPayment(payReq, payRes, (e) => console.error(e));

  const afterPay = await Product.findById(product._id);
  console.log('Inventory after PayPal confirm:', afterPay.inventory);

  console.log('\n--- Razorpay Flow ---');
  // Reset product inventory for next test
  await Product.findByIdAndUpdate(product._id, { $set: { inventory: 10 } });
  const prod2 = await Product.findById(product._id);
  console.log('Inventory reset to:', prod2.inventory);

  // Monkey-patch Razorpay verify to return true
  razorpayService.verifyPaymentSignature = (orderId, paymentId, signature) => true;

  // Create order with Razorpay
  ({ req, res } = makeReqRes({ ...orderBody, paymentMethod: 'Razorpay' }, user));
  await orderController.createOrder(req, res, (e) => console.error(e));
  const afterCreateR = await Product.findById(product._id);
  console.log('Inventory after create (Razorpay):', afterCreateR.inventory);

  // Call verifyRazorpayPayment
  const razorReq = { body: { orderId: (await Order.findOne({ user: user._id }))._id, razorpayOrderId: 'r_mock', razorpayPaymentId: 'pay_mock', razorpaySignature: 'sig_mock' }, user };
  const razorRes = { status(code) { this.statusCode = code; return this; }, json(obj) { console.log('Razorpay confirm resp:', obj.message || obj); } };
  await paymentController.verifyRazorpayPayment(razorReq, razorRes, (e) => console.error(e));

  const afterRazor = await Product.findById(product._id);
  console.log('Inventory after Razorpay confirm:', afterRazor.inventory);

  console.log('\n--- Stripe Webhook Flow ---');
  // Reset inventory
  await Product.findByIdAndUpdate(product._id, { $set: { inventory: 10 } });
  console.log('Inventory reset to 10');

  // Monkey-patch stripeService.verifyWebhookSignature to return our event
  stripeService.verifyWebhookSignature = (body, sig) => ({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_mock', metadata: { orderId: null }, amount: 1000, currency: 'usd' } } });

  // Create order for Stripe
  ({ req, res } = makeReqRes({ ...orderBody, paymentMethod: 'Stripe' }, user));
  await orderController.createOrder(req, res, (e) => console.error(e));
  const createdOrder = await Order.findOne({ user: user._id, paymentMethod: 'Stripe' });

  // Attach orderId to mocked event
  const event = { type: 'payment_intent.succeeded', data: { object: { id: 'pi_mock', metadata: { orderId: createdOrder._id.toString() }, amount: 1000, currency: 'usd' } } };
  // Call stripeWebhook with our event
  const stripeReq = { body: event, headers: { 'stripe-signature': 'sig' } };
  const stripeRes = { status(code) { this.statusCode = code; return this; }, json(obj) { console.log('Stripe webhook resp:', obj); } };
  await paymentController.stripeWebhook(stripeReq, stripeRes, (e) => console.error(e));

  const afterStripe = await Product.findById(product._id);
  console.log('Inventory after Stripe webhook:', afterStripe.inventory);

  await mongoose.disconnect();
  process.exit(0);
}

run();
