import mongoose from 'mongoose';

const variantOptionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Small", "Red"
  value: { type: String, required: true }, // e.g., "S", "#FF0000"
  price: { type: Number, default: 0 }, // Price adjustment
  inventory: { type: Number, default: 0 },
  sku: { type: String },
  image: { type: String }
});

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Size", "Color"
  options: [variantOptionSchema],
  isRequired: { type: Boolean, default: false }
});

const productVariantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, sparse: true },
  combination: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  price: { type: Number, required: true },
  inventory: { type: Number, default: 0 },
  image: { type: String },
  barcode: { type: String },
  weight: { type: Number },
  isActive: { type: Boolean, default: true }
});

const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: { type: String },
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
});

const productVideoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ['youtube', 'vimeo', 'upload'], required: true },
  thumbnail: { type: String }
});

const productFAQSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  order: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: true }
});

const productSpecificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: String, required: true },
  group: { type: String, default: 'General' },
  isHighlight: { type: Boolean, default: false }
});

const warehouseStockSchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  quantity: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  location: { type: String } // Bin/shelf location
});

const seoSchema = new mongoose.Schema({
  metaTitle: { type: String, maxlength: 60 },
  metaDescription: { type: String, maxlength: 160 },
  metaKeywords: [String],
  canonicalUrl: { type: String },
  ogTitle: { type: String },
  ogDescription: { type: String },
  ogImage: { type: String },
  structuredData: { type: mongoose.Schema.Types.Mixed }
});

const productSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Please enter a product title'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  description: {
    type: String,
    required: [true, 'Please enter a product description']
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Please enter product price'],
    min: [0, 'Price must be positive']
  },
  compareAtPrice: {
    type: Number,
    default: 0,
    validate: {
      validator: function(val) {
        return val >= 0;
      },
      message: 'Compare at price must be positive'
    }
  },
  costPrice: { type: Number, min: 0 }, // For profit calculation
  currency: { type: String, default: 'USD' },
  
  // Tax & Pricing
  taxClass: { type: String, default: 'standard' },
  taxExempt: { type: Boolean, default: false },
  
  // Category & Organization
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product must belong to a category']
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand'
  },
  tags: [{ type: String, lowercase: true }],
  
  // Media
  images: [productImageSchema],
  videos: [productVideoSchema],
  
  // Variants & Options
  hasVariants: { type: Boolean, default: false },
  variants: [variantSchema], // Variant definitions (Size, Color, etc.)
  productVariants: [productVariantSchema], // Actual variant combinations with SKU
  
  // Inventory Management
  inventory: {
    type: Number,
    required: [true, 'Please specify inventory count'],
    min: [0, 'Inventory cannot be negative'],
    default: 0
  },
  reservedInventory: { type: Number, default: 0 }, // For pending orders
  warehouseStock: [warehouseStockSchema],
  lowStockAlertThreshold: { type: Number, default: 5, min: 0 },
  trackInventory: { type: Boolean, default: true },
  allowBackorders: { type: Boolean, default: false },
  inventoryPolicy: {
    type: String,
    enum: ['deny', 'continue', 'notify'],
    default: 'deny'
  },
  
  // SKU & Barcode
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  barcode: { type: String },
  mpn: { type: String }, // Manufacturer Part Number
  isbn: { type: String },
  upc: { type: String },
  
  // Physical Properties
  weight: { type: Number }, // in kg
  dimensions: {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    unit: { type: String, enum: ['cm', 'in'], default: 'cm' }
  },
  
  // Shipping
  shippingClass: { type: String },
  freeShipping: { type: Boolean, default: false },
  shippingRequired: { type: Boolean, default: true },
  
  // Specifications & Details
  specifications: [productSpecificationSchema],
  faqs: [productFAQSchema],
  features: [{ type: String }],
  
  // Ratings & Reviews
  ratings: { type: Number, default: 0, min: 0, max: 5 },
  numReviews: { type: Number, default: 0 },
  reviewSummary: {
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    ratingDistribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },
  
  // SEO
  seo: seoSchema,
  
  // Status & Visibility
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'discontinued'],
    default: 'active'
  },
  visibility: {
    type: String,
    enum: ['visible', 'hidden', 'search_only'],
    default: 'visible'
  },
  publishedAt: { type: Date },
  
  // Featured & Promotions
  isFeatured: { type: Boolean, default: false },
  featuredUntil: { type: Date },
  isNewArrival: { type: Boolean, default: false },
  newArrivalUntil: { type: Date },
  isBestSeller: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },
  
  // Sales & Analytics
  totalSales: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  
  // Related Products
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  upsellProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  crossSellProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  
  // Vendor/Seller (for marketplace)
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ status: 1 });
productSchema.index({ 'tags': 1 });
productSchema.index({ title: 'text', description: 'text', shortDescription: 'text' });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ isFeatured: 1 });
productSchema.index({ createdAt: -1 });

// Virtual for available inventory
productSchema.virtual('availableInventory').get(function() {
  if (!this.trackInventory) return Infinity;
  return Math.max(0, this.inventory - this.reservedInventory);
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

// Virtual for is in stock
productSchema.virtual('inStock').get(function() {
  if (!this.trackInventory) return true;
  if (this.allowBackorders) return true;
  return this.availableInventory > 0;
});

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Auto-generate slug from title
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Set publishedAt when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Static method to calculate average rating
productSchema.statics.calculateAverageRating = async function(productId) {
  const Review = mongoose.model('Review');
  
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        numReviews: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        ratingDist: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    stats[0].ratingDist.forEach(r => {
      ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
    });

    await this.findByIdAndUpdate(productId, {
      ratings: Math.round(stats[0].avgRating * 10) / 10,
      numReviews: stats[0].numReviews,
      'reviewSummary.averageRating': stats[0].avgRating,
      'reviewSummary.totalReviews': stats[0].numReviews,
      'reviewSummary.ratingDistribution': ratingDistribution
    });
  } else {
    await this.findByIdAndUpdate(productId, {
      ratings: 0,
      numReviews: 0,
      'reviewSummary.averageRating': 0,
      'reviewSummary.totalReviews': 0,
      'reviewSummary.ratingDistribution': { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    });
  }
};

const Product = mongoose.model('Product', productSchema);
export default Product;
