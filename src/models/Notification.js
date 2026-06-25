import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'order_placed', 'order_confirmed', 'order_shipped', 'order_delivered',
      'order_cancelled', 'payment_success', 'payment_failed', 'refund_processed',
      'low_stock', 'new_product', 'price_drop', 'back_in_stock',
      'review_request', 'review_response', 'promo', 'newsletter',
      'account_security', 'system', 'custom'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Reference
  relatedType: {
    type: String,
    enum: ['order', 'product', 'user', 'payment', 'review', 'coupon', 'system']
  },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  
  // Action
  actionUrl: { type: String },
  actionText: { type: String },
  
  // Delivery status
  channels: {
    inApp: { sent: Boolean, readAt: Date },
    email: { sent: Boolean, sentAt: Date, error: String },
    sms: { sent: Boolean, sentAt: Date, error: String },
    push: { sent: Boolean, sentAt: Date, error: String }
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Read status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  // Expiry
  expiresAt: { type: Date },
  
  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
