import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  title: { type: String },
  image: { type: String },
  unitPrice: { type: Number },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String },
  condition: {
    type: String,
    enum: ['new', 'opened', 'used', 'damaged'],
    default: 'new'
  },
  refundAmount: { type: Number, default: 0 }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: { type: String },
  audience: {
    type: String,
    enum: ['customer', 'internal'],
    default: 'customer'
  },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const returnRequestSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  returnNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  returnReason: {
    type: String,
    enum: [
      'damaged', 'defective', 'wrong_item', 'not_as_described',
      'no_longer_needed', 'better_price_found', 'late_delivery', 'other'
    ],
    required: true
  },
  returnReasonDetails: { type: String, maxlength: 2000 },
  items: [returnItemSchema],
  refundType: {
    type: String,
    enum: ['original_payment', 'store_credit', 'exchange'],
    default: 'original_payment'
  },
  refundAmount: { type: Number, default: 0 },
  approvedRefundAmount: { type: Number },
  currency: { type: String, default: 'USD' },
  isPartialRefund: { type: Boolean, default: false },
  refundStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  exchangeItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number }
  }],
  status: {
    type: String,
    enum: [
      'pending', 'under_review', 'info_requested', 'approved', 'rejected',
      'processing', 'refunded', 'cancelled',
      'requested', 'completed'
    ],
    default: 'pending',
    index: true
  },
  statusHistory: [statusHistorySchema],
  returnShippingMethod: { type: String },
  returnShippingCost: { type: Number },
  returnShippingPaidBy: {
    type: String,
    enum: ['customer', 'merchant'],
    default: 'customer'
  },
  returnTrackingNumber: { type: String },
  returnTrackingUrl: { type: String },
  returnReceivedAt: { type: Date },
  customerNotes: { type: String, maxlength: 2000 },
  customerFacingNote: { type: String, maxlength: 2000 },
  adminNotes: { type: String, maxlength: 2000 },
  internalNotes: { type: String, maxlength: 2000 },
  photos: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  refundedAt: { type: Date }
}, {
  timestamps: true
});

returnRequestSchema.index({ returnNumber: 1 });
returnRequestSchema.index({ createdAt: -1 });

returnRequestSchema.pre('save', async function preSave(next) {
  if (!this.returnNumber) {
    const count = await mongoose.models.ReturnRequest.countDocuments();
    this.returnNumber = `RF-${Date.now().toString(36).toUpperCase()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  if (this.status === 'requested') this.status = 'pending';
  next();
});

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
