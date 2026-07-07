import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';
import { calculateOrderPricing } from '../utils/orderPricing.js';
import { isOrderOwnerOrAdmin } from '../utils/authHelpers.js';

// Create new order
export const createOrder = async (req, res, next) => {
  const {
    orderItems,
    shippingAddress,
    billingAddress,
    paymentMethod,
    taxPrice,
    shippingPrice,
    couponCode,
    customerNotes
  } = req.body;

  try {
    const pricing = await calculateOrderPricing({
      orderItems,
      couponCode,
      taxPrice,
      shippingPrice
    });

    const order = await Order.create({
      user: req.user._id,
      orderItems: pricing.verifiedItems,
      shippingAddress,
      billingAddress,
      paymentMethod,
      subtotal: pricing.subtotal,
      taxPrice: pricing.taxPrice,
      shippingPrice: pricing.shippingPrice,
      discountPrice: pricing.discountPrice,
      totalPrice: pricing.totalPrice,
      coupon: pricing.appliedCoupon?._id,
      customerNotes
    });

    if (pricing.appliedCoupon) {
      pricing.appliedCoupon.usedCount += 1;
      await pricing.appliedCoupon.save();
    }

    for (const item of pricing.verifiedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { inventory: -item.quantity }
      });
    }

    order.inventoryDeducted = true;
    order.orderStatus = paymentMethod === 'CashOnDelivery' ? 'Processing' : 'Awaiting Payment';
    await order.save();

    await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// Get order by ID
export const getOrderById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!isOrderOwnerOrAdmin(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

// Get my orders
export const getMyOrders = async (req, res, next) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 10;
    const page = parseInt(req.query.page) || 1;

    const count = await Order.countDocuments({ user: req.user._id });
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      success: true,
      orders,
      page,
      pages: Math.ceil(count / pageSize),
      totalOrders: count
    });
  } catch (error) {
    next(error);
  }
};

// Cancel eligible order
export const cancelOrder = async (req, res, next) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!isOrderOwnerOrAdmin(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    const eligibleStatuses = ['Pending', 'Paid', 'Awaiting Payment', 'Processing'];
    if (!eligibleStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status is: ${order.orderStatus}`
      });
    }

    if (order.inventoryDeducted) {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { inventory: item.quantity }
        });
      }
      order.inventoryDeducted = false;
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

// Download Invoice PDF
export const downloadInvoice = async (req, res, next) => {
  const { id } = req.params;

  try {
    const order = await Order.findById(id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!isOrderOwnerOrAdmin(order, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);

    generateInvoicePDF(order, res);
  } catch (error) {
    next(error);
  }
};
