import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import { calculateOrderPricing } from '../utils/orderPricing.js';

describe('calculateOrderPricing', () => {
  let category;
  let product;

  beforeEach(async () => {
    category = await Category.create({ name: 'Pricing Category', slug: 'pricing-category' });
    product = await Product.create({
      title: 'Pricing Product',
      slug: 'pricing-product',
      description: 'Pricing test product',
      price: 50,
      category: category._id,
      inventory: 10,
      images: [{ url: 'https://example.com/pricing.jpg', isPrimary: true }],
      status: 'active'
    });
  });

  it('calculates totals from database prices and ignores manipulated client prices', async () => {
    const pricing = await calculateOrderPricing({
      orderItems: [{
        product: product._id,
        title: 'Fake Title',
        quantity: 2,
        image: 'https://example.com/fake.jpg',
        price: 1
      }],
      taxPrice: 5,
      shippingPrice: 10
    });

    expect(pricing.subtotal).toBe(100);
    expect(pricing.totalPrice).toBe(115);
    expect(pricing.verifiedItems[0].price).toBe(50);
    expect(pricing.verifiedItems[0].title).toBe('Pricing Product');
  });

  it('applies valid coupon discounts server-side', async () => {
    await Coupon.create({
      code: 'SAVE10',
      discountType: 'percentage',
      discountAmount: 10,
      expiryDate: new Date(Date.now() + 86400000),
      minPurchaseAmount: 0
    });

    const pricing = await calculateOrderPricing({
      orderItems: [{
        product: product._id,
        title: product.title,
        quantity: 1,
        image: 'https://example.com/pricing.jpg',
        price: 50
      }],
      couponCode: 'SAVE10',
      taxPrice: 0,
      shippingPrice: 0
    });

    expect(pricing.discountPrice).toBe(5);
    expect(pricing.totalPrice).toBe(45);
    expect(pricing.appliedCoupon.code).toBe('SAVE10');
  });
});
