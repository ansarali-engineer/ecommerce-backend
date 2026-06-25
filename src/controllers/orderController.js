import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';

// Create new order
export const createOrder = async (req, res, next) => {
  const { orderItems, shippingAddress, paymentMethod, taxPrice, shippingPrice, discountPrice, totalPrice } = req.body;

  try {
    // 1. Verify and lock inventory stock first
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.title} not found` });
      }
      if (product.inventory < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory for ${product.title}. Only ${product.inventory} items left.`
        });
      }
    }

    // 2. Create the Order
    const order = await Order.create({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice,
      shippingPrice,
      discountPrice,
      totalPrice
    });

    // 3. Deduct stock immediately (reserve) for all orders to avoid overselling.
    //    We track `inventoryDeducted` on the order so payment handlers don't double-deduct,
    //    and cancellations will restore stock if necessary.
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { inventory: -item.quantity }
      });
    }
    order.inventoryDeducted = true;
    // Set initial status
    if (paymentMethod === 'CashOnDelivery') {
      order.orderStatus = 'Processing';
    } else {
      order.orderStatus = 'Awaiting Payment';
    }
    await order.save();

    // Clear user's cart
    await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
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

    // Security check: Only the customer who ordered or an admin can view it
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
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

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // Eligible for cancellation: only if status is 'Pending' or 'Paid' (before shipped/delivered/processing)
    const eligibleStatuses = ['Pending', 'Paid'];
    if (!eligibleStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status is: ${order.orderStatus}`
      });
    }

    // Refund stock if stock was already deducted (tracked by inventoryDeducted flag)
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

    // Security check
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);

    generateInvoicePDF(order, res);
  } catch (error) {
    next(error);
  }
};
