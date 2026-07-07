import ReturnRequest from '../models/Return.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import returnService from '../services/ReturnService.js';
import {
  REFUND_STATUSES,
  CANCELLABLE_STATUSES,
  ADMIN_ACTIONABLE,
  normalizeStatus
} from '../utils/refundConstants.js';

const formatReturn = (doc) => returnService.serializeReturn(doc);

export const getRefundEligibility = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    const eligibility = await returnService.checkOrderEligibility(order, req.user._id);
    res.json({ success: true, eligibility });
  } catch (error) {
    next(error);
  }
};

export const createReturnRequest = async (req, res, next) => {
  try {
    const { orderId, returnReason, returnReasonDetails, items, refundType, customerNotes, photos } = req.body;

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    const eligibility = await returnService.checkOrderEligibility(order, req.user._id);

    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, message: eligibility.reason });
    }

    const returnedQuantities = await returnService.getReturnedQuantities(orderId);
    const { processedItems, refundAmount } = returnService.validateItems(order, items, returnedQuantities);

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: req.user._id,
      returnReason,
      returnReasonDetails,
      items: processedItems,
      refundType,
      refundAmount,
      approvedRefundAmount: refundAmount,
      currency: order.currency || 'USD',
      isPartialRefund: false,
      customerNotes,
      photos: photos || [],
      status: REFUND_STATUSES.PENDING,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      statusHistory: [{
        status: REFUND_STATUSES.PENDING,
        note: 'Refund request submitted',
        updatedBy: req.user._id,
        audience: 'customer'
      }]
    });

    await returnService.notifyCustomer(req.user._id, {
      type: 'system',
      title: 'Refund Request Submitted',
      message: `Your refund request ${returnRequest.returnNumber} is pending review.`,
      relatedId: orderId,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    await returnService.notifyAdmins(
      'New Refund Request',
      `${req.user.name} submitted refund ${returnRequest.returnNumber} for order ${order.orderNumber || orderId}`,
      orderId
    );

    res.status(201).json({
      success: true,
      message: 'Refund request submitted successfully',
      returnRequest: formatReturn(returnRequest)
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const getUserReturns = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const returns = await ReturnRequest.find(query)
      .populate('order', 'orderNumber orderStatus totalPrice createdAt')
      .populate('items.product', 'title images slug')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      returns: returns.map(formatReturn)
    });
  } catch (error) {
    next(error);
  }
};

export const getReturnById = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate('order')
      .populate('items.product', 'title images price slug')
      .populate('user', 'name email')
      .populate('statusHistory.updatedBy', 'name role')
      .populate('processedBy', 'name');

    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    const isOwner = returnRequest.user._id.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin', 'support'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const formatted = formatReturn(returnRequest);
    if (!isAdmin) {
      formatted.internalNotes = undefined;
      formatted.statusHistory = formatted.statusHistory.filter(
        (entry) => entry.audience !== 'internal'
      );
    }

    res.json({ success: true, returnRequest: formatted });
  } catch (error) {
    next(error);
  }
};

export const cancelReturnRequest = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    const status = normalizeStatus(returnRequest.status);
    if (!CANCELLABLE_STATUSES.includes(returnRequest.status) && status !== REFUND_STATUSES.PENDING) {
      return res.status(400).json({
        success: false,
        message: 'This refund request can no longer be cancelled'
      });
    }

    returnRequest.status = REFUND_STATUSES.CANCELLED;
    returnRequest.updatedBy = req.user._id;
    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.CANCELLED,
      note: 'Cancelled by customer',
      updatedBy: req.user._id
    });

    await returnRequest.save();

    res.json({
      success: true,
      message: 'Refund request cancelled',
      returnRequest: formatReturn(returnRequest)
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReturns = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, q } = req.query;
    const query = {};

    if (status) query.status = status;

    if (q) {
      const searchRegex = new RegExp(q.trim(), 'i');
      const users = await User.find({
        $or: [{ email: searchRegex }, { name: searchRegex }]
      }).select('_id');
      const userIds = users.map((u) => u._id);

      query.$or = [
        { returnNumber: searchRegex },
        ...(userIds.length ? [{ user: { $in: userIds } }] : [])
      ];

      if (/^[0-9a-fA-F]{24}$/.test(q.trim())) {
        query.$or.push({ order: q.trim() }, { _id: q.trim() });
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [returns, total] = await Promise.all([
      ReturnRequest.find(query)
        .populate('order', 'orderNumber totalPrice orderStatus')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      ReturnRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      returns: returns.map(formatReturn),
      pagination: {
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
        total
      }
    });
  } catch (error) {
    next(error);
  }
};

export const approveReturn = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (!ADMIN_ACTIONABLE.approve.includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Refund cannot be approved in its current status' });
    }

    const {
      adminNotes,
      customerFacingNote,
      internalNotes,
      returnShippingMethod,
      returnShippingCost,
      returnShippingPaidBy
    } = req.body;

    returnRequest.status = REFUND_STATUSES.APPROVED;
    returnRequest.adminNotes = adminNotes;
    returnRequest.customerFacingNote = customerFacingNote;
    returnRequest.internalNotes = internalNotes;
    returnRequest.returnShippingMethod = returnShippingMethod;
    returnRequest.returnShippingCost = returnShippingCost;
    returnRequest.returnShippingPaidBy = returnShippingPaidBy;
    returnRequest.updatedBy = req.user._id;

    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.APPROVED,
      note: customerFacingNote || adminNotes || 'Refund approved',
      updatedBy: req.user._id,
      audience: 'customer'
    });

    if (internalNotes) {
      returnService.appendHistory(returnRequest, {
        status: REFUND_STATUSES.APPROVED,
        note: internalNotes,
        updatedBy: req.user._id,
        audience: 'internal'
      });
    }

    await returnRequest.save();

    await returnService.notifyCustomer(returnRequest.user, {
      type: 'refund_processed',
      title: 'Refund Approved',
      message: customerFacingNote || `Refund ${returnRequest.returnNumber} has been approved.`,
      relatedId: returnRequest.order,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    res.json({ success: true, message: 'Refund approved', returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export const rejectReturn = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (!ADMIN_ACTIONABLE.reject.includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Refund cannot be rejected in its current status' });
    }

    const { adminNotes, customerFacingNote, internalNotes } = req.body;
    const customerNote = customerFacingNote || adminNotes || 'Your refund request was rejected.';

    returnRequest.status = REFUND_STATUSES.REJECTED;
    returnRequest.adminNotes = adminNotes;
    returnRequest.customerFacingNote = customerNote;
    returnRequest.internalNotes = internalNotes;
    returnRequest.updatedBy = req.user._id;

    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.REJECTED,
      note: customerNote,
      updatedBy: req.user._id,
      audience: 'customer'
    });

    await returnRequest.save();

    await returnService.notifyCustomer(returnRequest.user, {
      type: 'system',
      title: 'Refund Rejected',
      message: customerNote,
      relatedId: returnRequest.order,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    res.json({ success: true, message: 'Refund rejected', returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export const requestReturnInfo = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (!ADMIN_ACTIONABLE.requestInfo.includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Cannot request info for this refund status' });
    }

    const { customerFacingNote, internalNotes } = req.body;

    returnRequest.status = REFUND_STATUSES.INFO_REQUESTED;
    returnRequest.customerFacingNote = customerFacingNote;
    returnRequest.internalNotes = internalNotes;
    returnRequest.updatedBy = req.user._id;

    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.INFO_REQUESTED,
      note: customerFacingNote,
      updatedBy: req.user._id,
      audience: 'customer'
    });

    await returnRequest.save();

    await returnService.notifyCustomer(returnRequest.user, {
      type: 'system',
      title: 'Additional Information Required',
      message: customerFacingNote,
      relatedId: returnRequest.order,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    res.json({ success: true, message: 'Information requested from customer', returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export const receiveReturn = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (!ADMIN_ACTIONABLE.receive.includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Return items cannot be received in current status' });
    }

    returnRequest.status = REFUND_STATUSES.PROCESSING;
    returnRequest.returnReceivedAt = new Date();
    returnRequest.updatedBy = req.user._id;

    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.PROCESSING,
      note: 'Returned items received at warehouse',
      updatedBy: req.user._id
    });

    await returnRequest.save();

    await returnService.notifyCustomer(returnRequest.user, {
      type: 'system',
      title: 'Return Received',
      message: `We received your return for ${returnRequest.returnNumber}. Refund processing will begin shortly.`,
      relatedId: returnRequest.order,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    res.json({ success: true, message: 'Return marked as received', returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export const processReturnRefund = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id).populate('order');
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (!ADMIN_ACTIONABLE.refund.includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Refund cannot be processed in current status' });
    }

    const order = returnRequest.order;
    const maxRefund = returnRequest.refundAmount;
    let finalRefund = req.body.refundAmount != null ? Number(req.body.refundAmount) : maxRefund;

    if (Number.isNaN(finalRefund) || finalRefund <= 0 || finalRefund > maxRefund) {
      return res.status(400).json({
        success: false,
        message: `Refund amount must be between 0.01 and ${maxRefund.toFixed(2)}`
      });
    }

    await returnService.processRefundPayment(returnRequest, order, finalRefund);

    if (req.body.restoreInventory !== false) {
      await returnService.restoreInventory(returnRequest, req.user._id);
    }

    returnRequest.status = REFUND_STATUSES.REFUNDED;
    returnRequest.refundStatus = 'completed';
    returnRequest.approvedRefundAmount = finalRefund;
    returnRequest.isPartialRefund = finalRefund < maxRefund;
    returnRequest.processedBy = req.user._id;
    returnRequest.updatedBy = req.user._id;
    returnRequest.refundedAt = new Date();

    if (req.body.customerFacingNote) {
      returnRequest.customerFacingNote = req.body.customerFacingNote;
    }
    if (req.body.internalNotes) {
      returnRequest.internalNotes = req.body.internalNotes;
    }

    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.REFUNDED,
      note: req.body.customerFacingNote || `Refund of ${finalRefund.toFixed(2)} ${returnRequest.currency} processed`,
      updatedBy: req.user._id,
      audience: 'customer'
    });

    await returnRequest.save();

    const totalReturned = await returnService.getReturnedQuantities(order._id);
    const totalOrderQty = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalReturnedQty = Object.values(totalReturned).reduce((a, b) => a + b, 0);

    if (totalReturnedQty >= totalOrderQty || finalRefund >= order.totalPrice) {
      order.orderStatus = 'Refunded';
      await order.save();
    }

    await returnService.notifyCustomer(returnRequest.user, {
      type: 'refund_processed',
      title: 'Refund Completed',
      message: `Your refund of ${finalRefund.toFixed(2)} ${returnRequest.currency} for ${returnRequest.returnNumber} has been processed.`,
      relatedId: order._id,
      actionUrl: `/refunds/${returnRequest._id}`
    });

    res.json({ success: true, message: 'Refund processed successfully', returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export const markUnderReview = async (req, res, next) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    if (![REFUND_STATUSES.PENDING, 'requested'].includes(returnRequest.status)) {
      return res.status(400).json({ success: false, message: 'Only pending requests can be moved to review' });
    }

    returnRequest.status = REFUND_STATUSES.UNDER_REVIEW;
    returnRequest.updatedBy = req.user._id;
    returnService.appendHistory(returnRequest, {
      status: REFUND_STATUSES.UNDER_REVIEW,
      note: req.body.internalNotes || 'Refund moved to under review',
      updatedBy: req.user._id,
      audience: 'internal'
    });

    await returnRequest.save();
    res.json({ success: true, returnRequest: formatReturn(returnRequest) });
  } catch (error) {
    next(error);
  }
};

export default {
  getRefundEligibility,
  createReturnRequest,
  getUserReturns,
  getReturnById,
  cancelReturnRequest,
  getAllReturns,
  approveReturn,
  rejectReturn,
  requestReturnInfo,
  receiveReturn,
  processReturnRefund,
  markUnderReview
};
