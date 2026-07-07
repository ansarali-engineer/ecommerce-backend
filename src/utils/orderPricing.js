import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

const getPrimaryImage = (product, fallback = '') => {
  if (product.images?.length) {
    const primary = product.images.find((img) => img.isPrimary) || product.images[0];
    return typeof primary === 'string' ? primary : primary?.url || fallback;
  }
  return fallback;
};

export const calculateOrderPricing = async ({
  orderItems,
  couponCode,
  taxPrice = 0,
  shippingPrice = 0
}) => {
  const verifiedItems = [];
  let subtotal = 0;

  for (const item of orderItems) {
    const product = await Product.findById(item.product);
    if (!product) {
      const error = new Error(`Product not found for item: ${item.title || item.product}`);
      error.statusCode = 404;
      throw error;
    }

    if (product.status !== 'active') {
      const error = new Error(`Product "${product.title}" is not available for purchase`);
      error.statusCode = 400;
      throw error;
    }

    if (product.trackInventory !== false && product.inventory < item.quantity) {
      const error = new Error(
        `Insufficient inventory for ${product.title}. Only ${product.inventory} items left.`
      );
      error.statusCode = 400;
      throw error;
    }

    const price = product.price;
    subtotal += price * item.quantity;

    verifiedItems.push({
      product: product._id,
      variant: item.variant,
      title: product.title,
      quantity: item.quantity,
      image: getPrimaryImage(product, item.image),
      price,
      sku: product.sku
    });
  }

  let discountPrice = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
    if (!coupon) {
      const error = new Error('Invalid coupon code');
      error.statusCode = 400;
      throw error;
    }

    if (!coupon.isValid(subtotal)) {
      const error = new Error('Coupon is inactive, expired, limit reached, or minimum purchase amount not met');
      error.statusCode = 400;
      throw error;
    }

    if (coupon.discountType === 'percentage') {
      discountPrice = (subtotal * coupon.discountAmount) / 100;
    } else {
      discountPrice = coupon.discountAmount;
    }
    discountPrice = Math.min(discountPrice, subtotal);
    appliedCoupon = coupon;
  }

  const normalizedTax = Math.max(0, Number(taxPrice) || 0);
  const normalizedShipping = Math.max(0, Number(shippingPrice) || 0);
  const totalPrice = Math.max(0, subtotal + normalizedTax + normalizedShipping - discountPrice);

  return {
    verifiedItems,
    subtotal,
    taxPrice: normalizedTax,
    shippingPrice: normalizedShipping,
    discountPrice,
    totalPrice,
    appliedCoupon
  };
};
