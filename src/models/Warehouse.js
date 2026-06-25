import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Warehouse name is required'],
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Location
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  
  // Contact
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  
  // Capacity
  capacity: { type: Number }, // Total storage capacity
  currentUtilization: { type: Number, default: 0 },
  
  // Operating Hours
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  
  // Priority for order fulfillment
  priority: { type: Number, default: 1 },
  
  // Shipping zones supported
  shippingZones: [{ type: String }]
}, {
  timestamps: true
});

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;
