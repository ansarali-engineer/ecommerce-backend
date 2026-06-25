import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId // Reference to product variant if applicable
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  
  // Movement Details
  type: {
    type: String,
    enum: [
      'purchase', 'sale', 'return', 'adjustment', 'transfer_in', 
      'transfer_out', 'damaged', 'lost', 'found', 'reserved', 
      'unreserved', 'production', 'opening_stock'
    ],
    required: true
  },
  quantity: { type: Number, required: true }, // Positive for incoming, negative for outgoing
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  
  // Reference
  referenceType: {
    type: String,
    enum: ['order', 'purchase_order', 'return', 'adjustment', 'transfer', 'manual']
  },
  referenceId: { type: String },
  
  // Costing
  unitCost: { type: Number },
  totalValue: { type: Number },
  
  // Metadata
  reason: { type: String },
  notes: { type: String },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Source/Destination (for transfers)
  sourceWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  destinationWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }
}, {
  timestamps: true
});

// Indexes
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ warehouse: 1 });
stockMovementSchema.index({ referenceId: 1 });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;
