import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' }, // Home, Work, Other
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String },
  isDefault: { type: Boolean, default: false }
});

const loginHistorySchema = new mongoose.Schema({
  ip: { type: String },
  userAgent: { type: String },
  device: { type: String },
  browser: { type: String },
  os: { type: String },
  location: {
    city: String,
    country: String
  },
  timestamp: { type: Date, default: Date.now },
  successful: { type: Boolean, default: true }
});

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  name: { type: String },
  type: { type: String, enum: ['desktop', 'mobile', 'tablet', 'other'], default: 'other' },
  lastActive: { type: Date, default: Date.now },
  ip: { type: String },
  userAgent: { type: String },
  trustLevel: { type: String, enum: ['trusted', 'recognized', 'new'], default: 'new' }
});

const mfaSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  secret: { type: String },
  backupCodes: [{ type: String }],
  verifiedAt: { type: Date }
});

const socialAccountSchema = new mongoose.Schema({
  provider: { type: String, enum: ['google', 'facebook', 'apple', 'github'], required: true },
  providerId: { type: String, required: true },
  email: { type: String },
  name: { type: String },
  picture: { type: String }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      // Password not required for social-only accounts
      return this.socialAccounts.length === 0;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Role-based access control
  role: {
    type: String,
    enum: ['customer', 'admin', 'super_admin', 'support', 'inventory_manager'],
    default: 'customer'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_products', 'manage_orders', 'manage_users', 'manage_categories',
      'manage_coupons', 'manage_inventory', 'view_analytics', 'manage_settings',
      'process_refunds', 'manage_support', 'view_reports', 'manage_shipping'
    ]
  }],
  
  // Profile Information
  avatar: { type: String },
  phone: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  
  // Addresses
  addresses: [addressSchema],
  
  // Email Verification
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationTokenExpires: Date,
  
  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  passwordChangedAt: Date,
  
  // Security Features
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  mfa: mfaSchema,
  
  // Session Management
  devices: [deviceSchema],
  loginHistory: [loginHistorySchema],
  refreshTokens: [{
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    deviceId: { type: String },
    isRevoked: { type: Boolean, default: false }
  }],
  
  // Social Login
  socialAccounts: [socialAccountSchema],
  
  // Store Credits & Gift Cards
  storeCredit: { type: Number, default: 0 },
  giftCards: [{
    code: { type: String, required: true },
    balance: { type: Number, required: true },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Loyalty Points
  loyaltyPoints: { type: Number, default: 0 },
  loyaltyTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  
  // Notification Preferences
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    newsletter: { type: Boolean, default: false }
  },
  
  // Account Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'pending_deletion'],
    default: 'active'
  },
  statusReason: String,
  suspendedAt: Date,
  
  // Terms & Privacy
  termsAcceptedAt: { type: Date },
  privacyAcceptedAt: { type: Date },
  
  // SEO & Marketing
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String },
  marketingSource: { type: String }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'socialAccounts.provider': 1, 'socialAccounts.providerId': 1 });
userSchema.index({ referralCode: 1 }, { sparse: true });

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // Check if password meets complexity requirements
  const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&#^()_+\-=]{6,}$/;
  if (this.password && !passwordComplexityRegex.test(this.password)) {
    const error = new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    return next(error);
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  return resetToken;
};

// Generate email verification token
userSchema.methods.createVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.verificationTokenExpires = Date.now() + 86400000; // 24 hours
  return verificationToken;
};

// Increment failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { failedLoginAttempts: 1 } };
  
  // Lock the account after 5 failed attempts for 2 hours
  if (this.failedLoginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 7200000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') return true;
  return this.permissions.includes(permission);
};

// Generate referral code
userSchema.methods.generateReferralCode = function() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  this.referralCode = code;
  return code;
};

const User = mongoose.model('User', userSchema);
export default User;
