import mongoose from 'mongoose';

const taxZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // Regions
  countries: [{ type: String }],
  states: [{ type: String }],
  cities: [{ type: String }],
  postalCodes: [{
    start: { type: String },
    end: { type: String }
  }],
  
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const taxClassSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['standard', 'reduced', 'zero', 'exempt', 'custom']
  },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const taxRateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  
  // Tax identification
  taxId: { type: String }, // GST, VAT, etc.
  taxType: {
    type: String,
    enum: ['vat', 'gst', 'sales_tax', 'service_tax'],
    default: 'sales_tax'
  },
  
  // Zone and Class
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxZone'
  },
  taxClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxClass'
  },
  
  // Rate
  rate: {
    type: Number,
    required: true,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  
  // Compound tax
  isCompound: { type: Boolean, default: false }, // Tax on tax
  compoundWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxRate'
  }],
  
  // Priority (for multiple taxes)
  priority: { type: Number, default: 1 },
  
  // Thresholds
  threshold: {
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number }
  },
  
  // Validity
  validFrom: { type: Date },
  validUntil: { type: Date },
  
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
taxRateSchema.index({ zone: 1, taxClass: 1 });
taxRateSchema.index({ isActive: 1 });

const TaxZone = mongoose.model('TaxZone', taxZoneSchema);
const TaxClass = mongoose.model('TaxClass', taxClassSchema);
const TaxRate = mongoose.model('TaxRate', taxRateSchema);

export { TaxZone, TaxClass, TaxRate };
