import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import emailService from '../services/EmailService.js';
import AuditLog from '../models/AuditLog.js';

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Set token cookies
const setTokenCookies = (res, accessToken, refreshToken = null) => {
  // Access token cookie (short-lived)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  // Refresh token cookie (long-lived)
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
};

// Register User
export const registerUser = async (req, res, next) => {
  const { name, email, password, referralCode } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user
    const userData = {
      name,
      email,
      password,
      verificationToken: crypto.createHash('sha256').update(verificationToken).digest('hex'),
      verificationTokenExpires,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date()
    };

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        userData.referredBy = referrer._id;
        // Give referrer some store credit or loyalty points
        await User.findByIdAndUpdate(referrer._id, {
          $inc: { loyaltyPoints: 100 }
        });
      }
    }

    const user = await User.create(userData);

    // Generate referral code for new user
    user.generateReferralCode();
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.name);
    } catch (err) {
      console.error('Failed to send verification email:', err.message);
    }

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken();

    // Save refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    await user.save();

    // Log registration
    await AuditLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'create',
      resourceType: 'user',
      description: 'User registered',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login User
export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Get user with password
    const user = await User.findOne({ email }).select('+password');

    // Check if user exists
    if (!user) {
      // Log failed attempt (we'll create a dummy log without user)
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is locked due to too many failed login attempts. Please try again later or reset your password.'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Increment failed login attempts
      await user.incLoginAttempts();

      // Log failed attempt
      user.loginHistory.push({
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        successful: false
      });
      await user.save();

      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password',
        attemptsRemaining: 5 - user.failedLoginAttempts - 1
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact support.`
      });
    }

    // Reset failed attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken();

    // Save refresh token and login history
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    user.loginHistory.push({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      successful: true
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log successful login
    await AuditLog.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      action: 'login',
      resourceType: 'user',
      description: 'User logged in',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Check if MFA is enabled
    if (user.mfa?.enabled) {
      return res.json({
        success: true,
        requireMFA: true,
        message: 'MFA verification required'
      });
    }

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
export const refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Find user with this refresh token
    const user = await User.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.isRevoked': false,
      'refreshTokens.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Mark old token as revoked
    const tokenIndex = user.refreshTokens.findIndex(
      t => t.token === refreshToken
    );
    if (tokenIndex > -1) {
      user.refreshTokens[tokenIndex].isRevoked = true;
    }

    // Generate new tokens
    const newAccessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken();

    // Add new refresh token
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Keep only last 5 refresh tokens per device
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (req, res, next) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken && req.user) {
      // Revoke the refresh token
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { refreshTokens: { token: refreshToken } } }
      );
    }

    // Log logout
    if (req.user) {
      await AuditLog.create({
        user: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: 'logout',
        resourceType: 'user',
        description: 'User logged out',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Logout from all devices
export const logoutAll = async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { refreshTokens: [] } }
    );

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Verify Email
export const verifyEmail = async (req, res, next) => {
  const { token } = req.query;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
export const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await emailService.sendVerificationEmail(user.email, verificationToken, user.name);

    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return res.json({ 
        success: true, 
        message: 'If an account exists with this email, a reset link has been sent.' 
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    try {
      await emailService.sendResetPasswordEmail(user.email, resetToken, user.name);
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      console.error('Password reset email failed:', err.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Email could not be sent' 
      });
    }

    res.json({ 
      success: true, 
      message: 'If an account exists with this email, a reset link has been sent.' 
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  const { token } = req.query;
  const { password } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    
    // Revoke all refresh tokens (logout from all devices)
    user.refreshTokens = [];
    await user.save();

    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    next(error);
  }
};

// Change Password
export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get User Profile
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -verificationToken -resetPasswordToken -refreshTokens');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Update User Profile
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const { name, phone, dateOfBirth, gender, addresses, notificationPreferences, avatar } = req.body;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (gender) user.gender = gender;
    if (avatar) user.avatar = avatar;
    if (addresses) user.addresses = addresses;
    if (notificationPreferences) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences
      };
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        addresses: updatedUser.addresses,
        notificationPreferences: updatedUser.notificationPreferences
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get Login History
export const getLoginHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('loginHistory devices')
      .slice('loginHistory', -20);

    res.json({
      success: true,
      loginHistory: user.loginHistory.reverse(),
      devices: user.devices
    });
  } catch (error) {
    next(error);
  }
};

// Revoke Device
export const revokeDevice = async (req, res, next) => {
  const { deviceId } = req.params;

  try {
    await User.updateOne(
      { _id: req.user._id },
      {
        $pull: {
          devices: { deviceId },
          refreshTokens: { deviceId }
        }
      }
    );

    res.json({
      success: true,
      message: 'Device revoked successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Social Login - Google
export const googleLogin = async (req, res, next) => {
  const { idToken, accessToken: googleAccessToken } = req.body;

  try {
    // Verify Google token (you'd use google-auth-library in production)
    // This is a simplified version
    const { GoogleAuth } = await import('google-auth-library');
    const client = new GoogleAuth();
    
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    
    let user = await User.findOne({ email: payload.email });

    if (!user) {
      // Create new user
      user = await User.create({
        name: payload.name,
        email: payload.email,
        avatar: payload.picture,
        isVerified: payload.email_verified,
        password: crypto.randomBytes(32).toString('hex'), // Random password for social login
        socialAccounts: [{
          provider: 'google',
          providerId: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        }]
      });

      user.generateReferralCode();
      await user.save();
    } else {
      // Add Google account if not already linked
      const hasGoogle = user.socialAccounts.some(
        sa => sa.provider === 'google' && sa.providerId === payload.sub
      );
      
      if (!hasGoogle) {
        user.socialAccounts.push({
          provider: 'google',
          providerId: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        });
        await user.save();
      }
    }

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken();

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    user.loginHistory.push({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      successful: true
    });
    await user.save();

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(401).json({
      success: false,
      message: 'Google authentication failed'
    });
  }
};

// Setup MFA
export const setupMFA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.mfa?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA is already enabled'
      });
    }

    // Generate secret using speakeasy (would need to install)
    const secret = crypto.randomBytes(20).toString('base32');
    
    // Generate backup codes
    const backupCodes = Array(10).fill(null).map(() => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    user.mfa = {
      secret,
      backupCodes,
      enabled: false // Will be enabled after verification
    };
    await user.save();

    res.json({
      success: true,
      secret,
      backupCodes,
      qrCodeUrl: `otpauth://totp/ECommerce:${user.email}?secret=${secret}&issuer=ECommerce`
    });
  } catch (error) {
    next(error);
  }
};

// Verify and Enable MFA
export const verifyMFA = async (req, res, next) => {
  const { code } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user.mfa?.secret) {
      return res.status(400).json({
        success: false,
        message: 'MFA not setup. Please setup MFA first.'
      });
    }

    // Verify the code (would use speakeasy in production)
    // This is simplified - use proper TOTP verification
    const isValid = code.length === 6; // Placeholder

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid MFA code'
      });
    }

    user.mfa.enabled = true;
    user.mfa.verifiedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'MFA enabled successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Disable MFA
export const disableMFA = async (req, res, next) => {
  const { password } = req.body;

  try {
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    user.mfa = {
      enabled: false,
      secret: undefined,
      backupCodes: [],
      verifiedAt: undefined
    };
    await user.save();

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    next(error);
  }
};
