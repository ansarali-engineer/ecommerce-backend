import ReturnRequest from '../models/Return.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import inventoryService from './InventoryService.js';
import notificationService from './NotificationService.js';
import {
  REFUND_WINDOW_DAYS,
  REFUND_STATUSES,
  CANCELLABLE_STATUSES,
  normalizeStatus
} from '../utils/refundConstants.js';

const ACTIVE_RETURN_STATUSES = [
  REFUND_STATUSES.PENDING,
  REFUND_STATUSES.UNDER_REVIEW,
  REFUND_STATUSES.INFO_REQUESTED,
  REFUND_STATUSES.APPROVED,
  REFUND_STATUSES.PROCESSING,
  'requested'
];

class ReturnService {
  appendHistory(returnRequest, { status, note, updatedBy, audience = 'customer' }) {
    returnRequest.statusHistory.push({
      status,
      note,
      updatedBy,
      audience,
      timestamp: new Date()
    });
  }

  async getReturnedQuantities(orderId, excludeReturnId = null) {
    const query = {
      order: orderId,
      status: { $in: ACTIVE_RETURN_STATUSES }
    };
    if (excludeReturnId) {
      query._id = { $ne: excludeReturnId };
    }

    const existingReturns = await ReturnRequest.find(query);
    const returned = {};

    for (const ret of existingReturns) {
      for (const item of ret.items) {
        const productId = item.product.toString();
        returned[productId] = (returned[productId] || 0) + item.quantity;
      }
    }

    return returned;
  }

  async checkOrderEligibility(order, userId) {
    if (!order) {
      return { eligible: false, reason: 'Order not found' };
    }

    if (order.user.toString() !== userId.toString()) {
      return { eligible: false, reason: 'Not authorized for this order' };
    }

    if (['Cancelled', 'Refunded'].includes(order.orderStatus)) {
      return { eligible: false, reason: 'Cancelled or refunded orders cannot be refunded again' };
    }

    const isDelivered = order.isDelivered || order.orderStatus === 'Delivered';
    if (!isDelivered) {
      return { eligible: false, reason: 'Order must be delivered before requesting a refund' };
    }

    if (!order.isPaid && order.paymentMethod !== 'CashOnDelivery') {
      return { eligible: false, reason: 'Only paid orders are eligible for refund' };
    }

    const deliveryDate = order.deliveredAt || order.updatedAt;
    const daysSinceDelivery = Math.floor(
      (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > REFUND_WINDOW_DAYS) {
      return {
        eligible: false,
        reason: `Refund window expired (${REFUND_WINDOW_DAYS} days after delivery)`,
        daysRemaining: 0
      };
    }

    const returnedQuantities = await this.getReturnedQuantities(order._id);
    const refundableItems = order.orderItems.map((item) => {
      const productId = item.product.toString();
      const alreadyReturned = returnedQuantities[productId] || 0;
      const maxRefundable = Math.max(0, item.quantity - alreadyReturned);
      return {
        product: productId,
        title: item.title,
        image: item.image,
        price: item.price,
        purchasedQuantity: item.quantity,
        alreadyReturned,
        maxRefundable
      };
    });

    const hasRefundableItems = refundableItems.some((i) => i.maxRefundable > 0);
    if (!hasRefundableItems) {
      return { eligible: false, reason: 'All items in this order already have active refund requests' };
    }

    return {
      eligible: true,
      daysRemaining: REFUND_WINDOW_DAYS - daysSinceDelivery,
      refundableItems,
      deliveryDate
    };
  }

  validateItems(order, items, returnedQuantities) {
    if (!items?.length) {
      throw Object.assign(new Error('Select at least one item to refund'), { statusCode: 400 });
    }

    const processedItems = [];
    let refundAmount = 0;

    for (const item of items) {
      const orderItem = order.orderItems.find(
        (oi) => oi.product.toString() === item.product
      );

      if (!orderItem) {
        throw Object.assign(
          new Error(`Product ${item.product} is not part of this order`),
          { statusCode: 400 }
        );
      }

      const alreadyReturned = returnedQuantities[item.product] || 0;
      const maxAllowed = orderItem.quantity - alreadyReturned;

      if (item.quantity > maxAllowed) {
        throw Object.assign(
          new Error(`Cannot refund ${item.quantity} of "${orderItem.title}". Maximum refundable: ${maxAllowed}`),
          { statusCode: 400 }
        );
      }

      const lineRefund = orderItem.price * item.quantity;
      refundAmount += lineRefund;

      processedItems.push({
        product: orderItem.product,
        title: orderItem.title,
        image: orderItem.image,
        unitPrice: orderItem.price,
        quantity: item.quantity,
        refundAmount: lineRefund,
        reason: item.reason
      });
    }

    return { processedItems, refundAmount };
  }

  async notifyCustomer(userId, { type, title, message, relatedId, actionUrl }) {
    await notificationService.createNotification({
      recipient: userId,
      type,
      title,
      message,
      relatedType: 'order',
      relatedId,
      actionUrl,
      actionText: 'View refund',
      channels: { inApp: true, email: true }
    });
  }

  async notifyAdmins(title, message, relatedId) {
    const admins = await User.find({
      role: { $in: ['admin', 'super_admin'] },
      status: 'active'
    }).select('_id');

    await Promise.all(
      admins.map((admin) =>
        notificationService.createNotification({
          recipient: admin._id,
          type: 'system',
          title,
          message,
          relatedType: 'order',
          relatedId,
          actionUrl: '/admin',
          actionText: 'Review refunds',
          channels: { inApp: true }
        })
      )
    );
  }

  async processRefundPayment(returnRequest, order, refundAmount) {
    if (returnRequest.refundType === 'store_credit') {
      await User.findByIdAndUpdate(returnRequest.user, {
        $inc: { storeCredit: refundAmount }
      });
      return { method: 'store_credit' };
    }

    if (returnRequest.refundType === 'exchange') {
      return { method: 'exchange' };
    }

    const payment = await Payment.findOne({ order: order._id, status: 'succeeded' });
    if (payment) {
      await Payment.create({
        order: order._id,
        transactionId: `refund-${returnRequest.returnNumber}-${Date.now()}`,
        amount: -refundAmount,
        currency: payment.currency || returnRequest.currency || 'USD',
        gateway: payment.gateway,
        status: 'refunded'
      });
    }

    return { method: 'original_payment', payment };
  }

  async restoreInventory(returnRequest, performedBy) {
    for (const item of returnRequest.items) {
      await inventoryService.addStock(item.product, item.quantity, 'return', {
        referenceType: 'return',
        referenceId: returnRequest._id,
        reason: `Refund #${returnRequest.returnNumber}`,
        userId: performedBy
      });
    }
  }

  serializeReturn(returnRequest) {
    const doc = returnRequest.toObject ? returnRequest.toObject() : returnRequest;
    return {
      ...doc,
      status: normalizeStatus(doc.status)
    };
  }
}

export default new ReturnService();
