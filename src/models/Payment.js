import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  gateway: {
    type: String,
    required: true,
    enum: ['Stripe', 'PayPal', 'Razorpay']
  },
  status: {
    type: String,
    required: true,
    enum: ['succeeded', 'failed', 'pending', 'refunded'],
    default: 'pending'
  },
  rawWebhookPayload: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
