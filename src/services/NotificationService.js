import Notification from '../models/Notification.js';
import User from '../models/User.js';
import emailService from './EmailService.js';

class NotificationService {
  /**
   * Create and send a notification
   */
  async createNotification({
    recipient,
    type,
    title,
    message,
    relatedType,
    relatedId,
    actionUrl,
    actionText,
    channels = { inApp: true, email: false, sms: false, push: false },
    priority = 'normal',
    metadata = {}
  }) {
    try {
      // Create notification record
      const notification = await Notification.create({
        recipient,
        type,
        title,
        message,
        relatedType,
        relatedId,
        actionUrl,
        actionText,
        priority,
        metadata,
        channels: {
          inApp: { sent: channels.inApp || false },
          email: { sent: false },
          sms: { sent: false },
          push: { sent: false }
        }
      });

      // Get user preferences
      const user = await User.findById(recipient);
      
      if (!user) {
        console.error('User not found for notification:', recipient);
        return notification;
      }

      // Send via different channels based on preferences
      if (channels.inApp) {
        notification.channels.inApp.sent = true;
        await notification.save();
      }

      // Send email if enabled in user preferences
      if (channels.email && user.notificationPreferences?.email) {
        try {
          await this.sendEmailNotification(user, title, message, actionUrl);
          notification.channels.email.sent = true;
          notification.channels.email.sentAt = new Date();
          await notification.save();
        } catch (err) {
          notification.channels.email.error = err.message;
          await notification.save();
        }
      }

      // Send push notification if enabled
      if (channels.push && user.notificationPreferences?.push) {
        try {
          await this.sendPushNotification(user, title, message, actionUrl);
          notification.channels.push.sent = true;
          notification.channels.push.sentAt = new Date();
          await notification.save();
        } catch (err) {
          notification.channels.push.error = err.message;
          await notification.save();
        }
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(user, title, message, actionUrl) {
    await emailService.sendMail({
      to: user.email,
      subject: title,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #d7a71a;">${title}</h2>
          <p>${message}</p>
          ${actionUrl ? `<a href="${actionUrl}" style="display: inline-block; background-color: #d7a71a; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">View Details</a>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #777;">This is an automated notification from our eCommerce platform.</p>
        </div>
      `
    });
  }

  /**
   * Send push notification (placeholder for integration)
   */
  async sendPushNotification(user, title, message, actionUrl) {
    // This would integrate with Firebase Cloud Messaging, OneSignal, etc.
    // For now, it's a placeholder that logs the notification
    console.log(`[Push Notification] To: ${user.email}, Title: ${title}, Message: ${message}`);
    return { success: true };
  }

  /**
   * Send SMS notification (placeholder for integration)
   */
  async sendSMSNotification(phone, message) {
    // This would integrate with Twilio, AWS SNS, etc.
    console.log(`[SMS] To: ${phone}, Message: ${message}`);
    return { success: true };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
    const query = { recipient: userId };
    
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId, 
      isRead: false 
    });

    return {
      notifications,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      unreadCount
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return result;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId
    });
    return result;
  }

  /**
   * Notification templates for common events
   */
  async notifyOrderPlaced(order, user) {
    return this.createNotification({
      recipient: user._id,
      type: 'order_placed',
      title: 'Order Confirmed',
      message: `Your order #${order._id.toString().slice(-8)} has been placed successfully.`,
      relatedType: 'order',
      relatedId: order._id,
      actionUrl: `/orders/${order._id}`,
      channels: { inApp: true, email: true, push: true }
    });
  }

  async notifyOrderShipped(order, user, trackingNumber) {
    return this.createNotification({
      recipient: user._id,
      type: 'order_shipped',
      title: 'Order Shipped',
      message: `Your order #${order._id.toString().slice(-8)} has been shipped. Tracking: ${trackingNumber}`,
      relatedType: 'order',
      relatedId: order._id,
      actionUrl: `/orders/${order._id}`,
      channels: { inApp: true, email: true, push: true }
    });
  }

  async notifyOrderDelivered(order, user) {
    return this.createNotification({
      recipient: user._id,
      type: 'order_delivered',
      title: 'Order Delivered',
      message: `Your order #${order._id.toString().slice(-8)} has been delivered.`,
      relatedType: 'order',
      relatedId: order._id,
      actionUrl: `/orders/${order._id}`,
      channels: { inApp: true, email: true, push: true }
    });
  }

  async notifyPaymentSuccess(order, user) {
    return this.createNotification({
      recipient: user._id,
      type: 'payment_success',
      title: 'Payment Successful',
      message: `Payment for order #${order._id.toString().slice(-8)} has been processed.`,
      relatedType: 'order',
      relatedId: order._id,
      actionUrl: `/orders/${order._id}`,
      channels: { inApp: true, email: true }
    });
  }

  async notifyPaymentFailed(order, user) {
    return this.createNotification({
      recipient: user._id,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Payment for order #${order._id.toString().slice(-8)} failed. Please try again.`,
      relatedType: 'order',
      relatedId: order._id,
      actionUrl: `/orders/${order._id}`,
      channels: { inApp: true, email: true, push: true },
      priority: 'high'
    });
  }

  async notifyLowStock(product, adminUsers) {
    const notifications = [];
    for (const admin of adminUsers) {
      const notification = await this.createNotification({
        recipient: admin._id,
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.title} has only ${product.inventory} items left in stock.`,
        relatedType: 'product',
        relatedId: product._id,
        actionUrl: `/admin/products/${product._id}`,
        channels: { inApp: true, email: true },
        priority: 'high'
      });
      notifications.push(notification);
    }
    return notifications;
  }

  async notifyPriceDrop(product, users, oldPrice, newPrice) {
    const notifications = [];
    for (const user of users) {
      const notification = await this.createNotification({
        recipient: user._id,
        type: 'price_drop',
        title: 'Price Drop Alert',
        message: `${product.title} price dropped from $${oldPrice} to $${newPrice}!`,
        relatedType: 'product',
        relatedId: product._id,
        actionUrl: `/products/${product.slug}`,
        channels: { inApp: true, email: true, push: true }
      });
      notifications.push(notification);
    }
    return notifications;
  }

  async notifyBackInStock(product, users) {
    const notifications = [];
    for (const user of users) {
      const notification = await this.createNotification({
        recipient: user._id,
        type: 'back_in_stock',
        title: 'Back in Stock',
        message: `${product.title} is back in stock!`,
        relatedType: 'product',
        relatedId: product._id,
        actionUrl: `/products/${product.slug}`,
        channels: { inApp: true, email: true, push: true }
      });
      notifications.push(notification);
    }
    return notifications;
  }

  async notifyReviewRequest(order, product, user) {
    return this.createNotification({
      recipient: user._id,
      type: 'review_request',
      title: 'Review Your Purchase',
      message: `How was ${product.title}? Leave a review and help others!`,
      relatedType: 'product',
      relatedId: product._id,
      actionUrl: `/products/${product.slug}#review`,
      channels: { inApp: true, email: true }
    });
  }
}

export default new NotificationService();
