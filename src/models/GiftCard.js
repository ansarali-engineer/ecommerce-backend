import mongoose from 'mongoose';
import crypto from 'crypto';

const giftCardSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Value
  initialBalance: {
    type: Number,
    required: true,
    min: [1, 'Gift card must have a minimum value of $1']
  },
  balance: {
    type: Number,
    required: true,
    min: [0, 'Balance cannot be negative']
  },
  currency: { type: String, default: 'USD' },
  
  // Type
  type: {
    type: String,
    enum: ['physical', 'digital', 'promotional'],
    default: 'digital'
  },
  
  // Purchaser
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Recipient
  recipientEmail: { type: String },
  recipientName: { type: String },
  message: { type: String },
  
  // Design
  design: { type: String }, // Template ID or URL
  theme: { type: String, enum: ['birthday', 'holiday', 'general', 'custom'], default: 'general' },
  
  // Delivery
  deliveryMethod: {
    type: String,
    enum: ['email', 'mail', 'in_store'],
    default: 'email'
  },
  deliveryDate: { type: Date },
  sentAt: { type: Date },
  
  // Validity
  expiresAt: { type: Date },
  neverExpires: { type: Boolean, default: false },
  
  // Order reference
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  
  // Redemptions
  redemptions: [{
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    amount: { type: Number },
    redeemedAt: { type: Date, default: Date.now }
  }],
  
  // Activation
  activatedAt: { type: Date },
  activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Indexes
giftCardSchema.index({ code: 1 });
giftCardSchema.index({ purchasedBy: 1 });
giftCardSchema.index({ recipientEmail: 1 });
giftCardSchema.index({ status: 1 });

// Static method to generate code
giftCardSchema.statics.generateCode = function() {
  const prefix = 'GC';
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  const checkDigit = Math.floor(Math.random() * 10);
  return `${prefix}${random}${checkDigit}`;
};

// Method to check if valid
giftCardSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.balance <= 0) return false;
  if (!this.neverExpires && this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Method to redeem
giftCardSchema.methods.redeem = async function(amount, orderId) {
  if (!this.isValid()) {
    throw new Error('Gift card is not valid');
  }
  if (amount > this.balance) {
    throw new Error('Amount exceeds gift card balance');
  }
  
  this.balance -= amount;
  this.redemptions.push({ order: orderId, amount });
  
  if (this.balance === 0) {
    this.status = 'redeemed';
  }
  
  await this.save();
  return this.balance;
};

const GiftCard = mongoose.model('GiftCard', giftCardSchema);
export default GiftCard;
