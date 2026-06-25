import mongoose from 'mongoose';

const shippingZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: { type: String },
  
  // Regions covered
  countries: [{ type: String }], // ISO country codes
  states: [{ type: String }],
  cities: [{ type: String }],
  postalCodes: [{
    start: { type: String },
    end: { type: String }
  }],
  
  // Status
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const shippingMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: { type: String },
  
  // Zones where this method is available
  zones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingZone'
  }],
  
  // Pricing
  pricingType: {
    type: String,
    enum: ['flat', 'weight_based', 'price_based', 'quantity_based'],
    default: 'flat'
  },
  baseCost: { type: Number, default: 0 },
  
  // Weight-based pricing
  weightRates: [{
    minWeight: { type: Number },
    maxWeight: { type: Number },
    cost: { type: Number }
  }],
  
  // Price-based pricing (order value)
  priceRates: [{
    minPrice: { type: Number },
    maxPrice: { type: Number },
    cost: { type: Number }
  }],
  
  // Quantity-based pricing
  quantityRates: [{
    minQuantity: { type: Number },
    maxQuantity: { type: Number },
    cost: { type: Number }
  }],
  
  // Free shipping threshold
  freeShippingThreshold: { type: Number },
  
  // Delivery estimates
  estimatedDeliveryDays: {
    min: { type: Number },
    max: { type: Number }
  },
  
  // Carrier integration
  carrier: {
    name: { type: String },
    code: { type: String },
    serviceName: { type: String }
  },
  
  // Restrictions
  maxWeight: { type: Number }, // in kg
  maxDimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, {
  timestamps: true
});

const shipmentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Shipping details
  shippingMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingMethod'
  },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  carrier: { type: String },
  carrierService: { type: String },
  
  // Status
  status: {
    type: String,
    enum: [
      'pending', 'label_created', 'picked_up', 'in_transit',
      'out_for_delivery', 'delivered', 'failed_delivery',
      'returned', 'cancelled'
    ],
    default: 'pending'
  },
  statusHistory: [{
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    location: { type: String },
    description: { type: String }
  }],
  
  // Addresses
  originAddress: {
    name: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    phone: String
  },
  destinationAddress: {
    name: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    phone: String
  },
  
  // Package details
  packages: [{
    weight: Number,
    length: Number,
    width: Number,
    height: Number,
    description: String
  }],
  
  // Cost
  shippingCost: { type: Number },
  insurance: { type: Number },
  
  // Delivery
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },
  
  // Pickup
  pickupDate: { type: Date },
  pickupTime: { type: String },
  
  // Labels
  labelUrl: { type: String },
  commercialInvoiceUrl: { type: String }
}, {
  timestamps: true
});

// Indexes
shippingZoneSchema.index({ name: 1 });
shippingMethodSchema.index({ code: 1 });
shippingMethodSchema.index({ isActive: 1 });
shipmentSchema.index({ order: 1 });
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ status: 1 });

const ShippingZone = mongoose.model('ShippingZone', shippingZoneSchema);
const ShippingMethod = mongoose.model('ShippingMethod', shippingMethodSchema);
const Shipment = mongoose.model('Shipment', shipmentSchema);

export { ShippingZone, ShippingMethod, Shipment };
