import ReturnRequest from '../models/Return.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import inventoryService from '../services/InventoryService.js';
import notificationService from '../services/NotificationService.js';

/**
 * Create return request
 */
export const createReturnRequest = async (req, res, next) => {
  const { orderId, returnReason, returnReasonDetails, items, refundType, customerNotes, photos } = req.body;

  try {
    // Verify order belongs to user
    const order = await Order.findOne({ _id: orderId, user: req.user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order is eligible for return (delivered within 30 days)
    const isDelivered = order.isDelivered || order.orderStatus === 'Delivered';
    if (!isDelivered) {
      return res.status(400).json({
        success: false,
        message: 'Order must be delivered before requesting a return'
      });
    }

    const deliveryDate = order.deliveredAt || order.updatedAt;
    const daysSinceDelivery = Math.floor(
      (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > 30) {
      return res.status(400).json({
        success: false,
        message: 'Return period has expired (30 days after delivery)'
      });
    }

    // Validate items
    for (const item of items) {
      const orderItem = order.orderItems.find(
        oi => oi.product.toString() === item.product
      );
      
      if (!orderItem) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product} not found in order`
        });
      }

      if (item.quantity > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot return more items than purchased for product ${item.product}`
        });
      }
    }

    // Calculate refund amount
    let refundAmount = 0;
    const processedItems = items.map(item => {
      const orderItem = order.orderItems.find(
        oi => oi.product.toString() === item.product
      );
      refundAmount += orderItem.price * item.quantity;
      return {
        ...item,
        refundAmount: orderItem.price * item.quantity
      };
    });

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: req.user._id,
      returnReason,
      returnReasonDetails,
      items: processedItems,
      refundType,
      refundAmount,
      customerNotes,
      photos,
      statusHistory: [{
        status: 'requested',
        note: 'Return request submitted by customer'
      }]
    });

    // Notify admin
    await notificationService.createNotification({
      recipient: req.user._id, // Would be admin in production
      type: 'system',
      title: 'New Return Request',
      message: `Return request #${returnRequest.returnNumber} submitted for order ${orderId}`,
      relatedType: 'order',
      relatedId: orderId
    });

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully',
      returnRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's return requests
 */
export const getUserReturns = async (req, res, next) => {
  try {
    const returns = await ReturnRequest.find({ user: req.user._id })
      .populate('order', 'orderStatus createdAt totalPrice')
      .populate('items.product', 'title images')
      .sort({ createdAt: -1 });

    res.json({ success: true, returns });
  } catch (error) {
    next(error);
  }
};

/**
 * Get return request by ID
 */
export const getReturnById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const returnRequest = await ReturnRequest.findById(id)
      .populate('order')
      .populate('items.product', 'title images price')
      .populate('user', 'name email');

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    // Check ownership or admin
    const isOwner = returnRequest.user._id.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.json({ success: true, returnRequest });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all return requests
 */
export const getAllReturns = async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;

  try {
    const query = {};
    if (status) query.status = status;

    const returns = await ReturnRequest.find(query)
      .populate('order', 'orderNumber totalPrice')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ReturnRequest.countDocuments(query);

    res.json({
      success: true,
      returns,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Approve return request
 */
export const approveReturn = async (req, res, next) => {
  const { id } = req.params;
  const { adminNotes, returnShippingMethod, returnShippingCost, returnShippingPaidBy } = req.body;

  try {
    const returnRequest = await ReturnRequest.findById(id);

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    if (returnRequest.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: 'Return request is not in requested status'
      });
    }

    // Update status
    returnRequest.status = 'approved';
    returnRequest.adminNotes = adminNotes;
    returnRequest.returnShippingMethod = returnShippingMethod;
    returnRequest.returnShippingCost = returnShippingCost;
    returnRequest.returnShippingPaidBy = returnShippingPaidBy;
    returnRequest.statusHistory.push({
      status: 'approved',
      note: adminNotes || 'Return request approved',
      updatedBy: req.user._id
    });

    await returnRequest.save();

    // Notify customer
    await notificationService.createNotification({
      recipient: returnRequest.user,
      type: 'order_cancelled',
      title: 'Return Approved',
      message: `Your return request #${returnRequest.returnNumber} has been approved`,
      relatedType: 'order',
      relatedId: returnRequest.order
    });

    res.json({
      success: true,
      message: 'Return request approved',
      returnRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reject return request
 */
export const rejectReturn = async (req, res, next) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  try {
    const returnRequest = await ReturnRequest.findById(id);

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    returnRequest.status = 'rejected';
    returnRequest.adminNotes = adminNotes;
    returnRequest.statusHistory.push({
      status: 'rejected',
      note: adminNotes,
      updatedBy: req.user._id
    });

    await returnRequest.save();

    // Notify customer
    await notificationService.createNotification({
      recipient: returnRequest.user,
      type: 'system',
      title: 'Return Request Rejected',
      message: `Your return request #${returnRequest.returnNumber} has been rejected`,
      relatedType: 'order',
      relatedId: returnRequest.order
    });

    res.json({
      success: true,
      message: 'Return request rejected',
      returnRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Mark return as received
 */
export const receiveReturn = async (req, res, next) => {
  const { id } = req.params;

  try {
    const returnRequest = await ReturnRequest.findById(id);

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    returnRequest.status = 'processing';
    returnRequest.returnReceivedAt = new Date();
    returnRequest.statusHistory.push({
      status: 'processing',
      note: 'Return items received',
      updatedBy: req.user._id
    });

    await returnRequest.save();

    res.json({
      success: true,
      message: 'Return marked as received',
      returnRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Process refund for return
 */
export const processReturnRefund = async (req, res, next) => {
  const { id } = req.params;

  try {
    const returnRequest = await ReturnRequest.findById(id)
      .populate('order');

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    const order = returnRequest.order;

    // Process refund based on refund type
    if (returnRequest.refundType === 'original_payment') {
      // Find the original payment
      const payment = await Payment.findOne({ order: order._id, status: 'succeeded' });

      if (payment) {
        // Process refund through payment gateway
        // This would call the appropriate payment service
        // For now, we'll just mark it as refunded
        
        // Record refund
        await Payment.create({
          order: order._id,
          transactionId: `refund-${Date.now()}`,
          amount: -returnRequest.refundAmount,
          currency: payment.currency,
          gateway: payment.gateway,
          status: 'refunded'
        });
      }
    } else if (returnRequest.refundType === 'store_credit') {
      // Add store credit to user
      await User.findByIdAndUpdate(returnRequest.user, {
        $inc: { storeCredit: returnRequest.refundAmount }
      });
    }

    // Return stock to inventory
    for (const item of returnRequest.items) {
      await inventoryService.addStock(
        item.product,
        item.quantity,
        'return',
        {
          referenceType: 'return',
          referenceId: returnRequest._id,
          reason: `Return #${returnRequest.returnNumber}`
        }
      );
    }

    // Update return status
    returnRequest.status = 'completed';
    returnRequest.refundStatus = 'completed';
    returnRequest.processedBy = req.user._id;
    returnRequest.statusHistory.push({
      status: 'completed',
      note: 'Refund processed and stock returned',
      updatedBy: req.user._id
    });

    await returnRequest.save();

    // Update order if all items returned
    const totalOrderItems = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalReturnedItems = returnRequest.items.reduce((sum, item) => sum + item.quantity, 0);

    if (totalReturnedItems >= totalOrderItems) {
      order.orderStatus = 'Refunded';
      await order.save();
    }

    // Notify customer
    await notificationService.createNotification({
      recipient: returnRequest.user,
      type: 'refund_processed',
      title: 'Refund Processed',
      message: `Your refund of $${returnRequest.refundAmount.toFixed(2)} for return #${returnRequest.returnNumber} has been processed`,
      relatedType: 'order',
      relatedId: order._id
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      returnRequest
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createReturnRequest,
  getUserReturns,
  getReturnById,
  getAllReturns,
  approveReturn,
  rejectReturn,
  receiveReturn,
  processReturnRefund
};
