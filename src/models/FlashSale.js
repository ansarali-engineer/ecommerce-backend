import mongoose from 'mongoose';

const flashSaleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: { type: String },
  
  // Timing
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  
  // Products
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variant: { type: mongoose.Schema.Types.ObjectId },
    salePrice: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    discount: { type: Number }, // Percentage
    maxQuantity: { type: Number, default: null }, // Max quantity per customer
    totalQuantity: { type: Number }, // Total available for sale
    soldQuantity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],
  
  // Global limits
  maxItemsPerUser: { type: Number, default: 5 },
  
  // Banner
  bannerImage: { type: String },
  bannerText: { type: String },
  
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  
  // Analytics
  totalSales: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
flashSaleSchema.index({ startTime: 1 });
flashSaleSchema.index({ endTime: 1 });
flashSaleSchema.index({ status: 1 });

// Virtual for is active
flashSaleSchema.virtual('isLive').get(function() {
  const now = new Date();
  return this.status === 'active' || (now >= this.startTime && now <= this.endTime && this.status !== 'cancelled');
});

// Method to check if product is in flash sale
flashSaleSchema.methods.getProductSalePrice = function(productId, variantId = null) {
  const productItem = this.products.find(p => 
    p.product.toString() === productId.toString() && 
    (!variantId || (p.variant && p.variant.toString() === variantId.toString()))
  );
  return productItem ? productItem.salePrice : null;
};

const FlashSale = mongoose.model('FlashSale', flashSaleSchema);
export default FlashSale;
