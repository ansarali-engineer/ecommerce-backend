import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Return details
  returnNumber: {
    type: String,
    unique: true,
    required: true
  },
  returnReason: {
    type: String,
    enum: [
      'damaged', 'defective', 'wrong_item', 'not_as_described',
      'no_longer_needed', 'better_price_found', 'late_delivery', 'other'
    ],
    required: true
  },
  returnReasonDetails: { type: String },
  
  // Items to return
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: { type: Number, required: true },
    reason: { type: String },
    condition: {
      type: String,
      enum: ['new', 'opened', 'used', 'damaged'],
      default: 'new'
    },
    refundAmount: { type: Number }
  }],
  
  // Refund
  refundType: {
    type: String,
    enum: ['original_payment', 'store_credit', 'exchange'],
    default: 'original_payment'
  },
  refundAmount: { type: Number },
  refundStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  
  // Exchange (if applicable)
  exchangeItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'processing', 'completed', 'cancelled'],
    default: 'requested'
  },
  statusHistory: [{
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Return shipping
  returnShippingMethod: { type: String },
  returnShippingCost: { type: Number },
  returnShippingPaidBy: {
    type: String,
    enum: ['customer', 'merchant'],
    default: 'customer'
  },
  
  // Tracking
  returnTrackingNumber: { type: String },
  returnTrackingUrl: { type: String },
  returnReceivedAt: { type: Date },
  
  // Notes
  customerNotes: { type: String },
  adminNotes: { type: String },
  
  // Photos
  photos: [{ type: String }],
  
  // Processed by
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ user: 1 });
returnRequestSchema.index({ returnNumber: 1 });
returnRequestSchema.index({ status: 1 });

// Generate return number
returnRequestSchema.pre('save', async function(next) {
  if (!this.returnNumber) {
    const count = await mongoose.models.ReturnRequest.countDocuments();
    this.returnNumber = `RET-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
