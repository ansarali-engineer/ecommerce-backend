import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId
  },
  title: { type: String, required: true },
  quantity: { type: Number, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  sku: { type: String }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Order number
  orderNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  
  orderItems: [orderItemSchema],
  
  // Addresses
  shippingAddress: {
    name: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String }
  },
  billingAddress: {
    name: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    phone: { type: String }
  },
  
  // Payment
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Stripe', 'PayPal', 'Razorpay', 'CashOnDelivery', 'BankTransfer']
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  
  // Shipping
  shippingMethod: { type: String },
  shippingMethodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingMethod'
  },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  
  // Pricing
  subtotal: { type: Number, required: true, default: 0.0 },
  taxPrice: { type: Number, required: true, default: 0.0 },
  taxBreakdown: [{
    name: String,
    rate: Number,
    amount: Number
  }],
  shippingPrice: { type: Number, required: true, default: 0.0 },
  discountPrice: { type: Number, required: true, default: 0.0 },
  totalPrice: { type: Number, required: true, default: 0.0 },
  
  // Coupon and discounts
  coupon: {
    code: String,
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    discountAmount: Number
  },
  
  // Gift card
  giftCard: {
    code: String,
    amount: Number
  },
  
  // Store credit used
  storeCreditUsed: { type: Number, default: 0 },
  
  // Status
  orderStatus: {
    type: String,
    required: true,
    enum: [
      'Pending', 'Awaiting Payment', 'Paid', 'Processing', 'Ready to Ship',
      'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned',
      'Refunded', 'Failed'
    ],
    default: 'Pending'
  },
  
  // Status history
  statusHistory: [{
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Flags
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  paymentAttempts: { type: Number, default: 0 },
  
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
  
  isCancelled: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  
  isRefunded: { type: Boolean, default: false },
  refundAmount: { type: Number },
  refundedAt: { type: Date },
  // Whether inventory was already deducted for this order
  inventoryDeducted: { type: Boolean, default: false },
  
  // Customer notes
  customerNotes: { type: String },
  adminNotes: { type: String },
  
  // IP and user agent for fraud detection
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Estimated delivery
  estimatedDelivery: { type: Date }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ isPaid: 1 });
orderSchema.index({ createdAt: -1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber && this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Count orders for today
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const count = await mongoose.models.Order.countDocuments({
      createdAt: { $gte: todayStart }
    });
    
    const sequence = (count + 1).toString().padStart(4, '0');
    this.orderNumber = `AG${year}${month}${day}${sequence}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
