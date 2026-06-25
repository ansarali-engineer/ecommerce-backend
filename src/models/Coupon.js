import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please enter coupon code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required']
  },
  discountAmount: {
    type: Number,
    required: [true, 'Discount amount is required'],
    min: [0, 'Discount amount cannot be negative']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  maxUses: {
    type: Number,
    default: 100
  },
  usedCount: {
    type: Number,
    default: 0
  },
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Check if coupon is valid
couponSchema.methods.isValid = function (purchaseAmount) {
  const isExpired = new Date() > this.expiryDate;
  const isLimitReached = this.usedCount >= this.maxUses;
  const isMinAmountSatisfied = purchaseAmount >= this.minPurchaseAmount;

  return this.isActive && !isExpired && !isLimitReached && isMinAmountSatisfied;
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
