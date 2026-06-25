import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: { type: String },
  userEmail: { type: String },
  
  // What action was performed
  action: {
    type: String,
    enum: [
      'create', 'update', 'delete', 'login', 'logout', 'view',
      'export', 'import', 'restore', 'archive', 'publish', 'unpublish',
      'approve', 'reject', 'suspend', 'activate', 'refund', 'cancel'
    ],
    required: true
  },
  
  // What was affected
  resourceType: {
    type: String,
    required: true,
    enum: [
      'user', 'product', 'category', 'brand', 'order', 'payment',
      'coupon', 'review', 'warehouse', 'inventory', 'settings', 'admin'
    ]
  },
  resourceId: { type: String },
  resourceName: { type: String },
  
  // Details
  description: { type: String, required: true },
  
  // Changes (before/after for updates)
  changes: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    fields: [String]
  },
  
  // Context
  ip: { type: String },
  userAgent: { type: String },
  location: {
    city: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Request details
  requestId: { type: String },
  method: { type: String },
  endpoint: { type: String },
  
  // Status
  status: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    default: 'success'
  },
  errorMessage: { type: String },
  
  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: 1 });

// TTL index - auto-delete logs after 1 year
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
