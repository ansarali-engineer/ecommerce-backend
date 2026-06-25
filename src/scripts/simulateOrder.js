import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import { createOrder } from '../controllers/orderController.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce');

  // Ensure a test user
  let user = await User.findOne({ email: 'testorder@example.com' });
  if (!user) {
    user = await User.create({ name: 'Test Buyer', email: 'testorder@example.com', password: 'Test1234', isVerified: true });
    console.log('Created test user:', user.email);
  }

  // Ensure a product exists
  let product = await Product.findOne();
  if (!product) {
    product = await Product.create({ title: 'Sim Product', description: 'Simulated product', price: 9.99, inventory: 5, images: [{ url: 'https://via.placeholder.com/150' }] });
    console.log('Created product:', product._id.toString());
  }

  console.log('Inventory before:', product.inventory);

  const req = {
    body: {
      orderItems: [
        { product: product._id, title: product.title, quantity: 2, image: product.images?.[0]?.url || '', price: product.price }
      ],
      shippingAddress: { street: '123 Test St', city: 'Testville', state: 'TS', zipCode: '12345', country: 'Testland' },
      paymentMethod: 'CashOnDelivery',
      taxPrice: 0,
      shippingPrice: 0,
      discountPrice: 0,
      totalPrice: product.price * 2
    },
    user
  };

  const res = {
    status(code) { this.statusCode = code; return this; },
    json(obj) { console.log('Controller response:', obj); }
  };

  try {
    await createOrder(req, res, (err) => { if (err) console.error('Controller error:', err); });

    const updated = await Product.findById(product._id);
    console.log('Inventory after:', updated.inventory);
  } catch (err) {
    console.error('Simulate error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
