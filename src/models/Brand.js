import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brand name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  logo: { type: String },
  banner: { type: String },
  website: { type: String },
  
  // SEO
  metaTitle: { type: String, maxlength: 60 },
  metaDescription: { type: String, maxlength: 160 },
  
  // Status
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  
  // Verification
  isVerified: { type: Boolean, default: false }
}, {
  timestamps: true
});

brandSchema.index({ slug: 1 });
brandSchema.index({ name: 'text' });

const Brand = mongoose.model('Brand', brandSchema);
export default Brand;
