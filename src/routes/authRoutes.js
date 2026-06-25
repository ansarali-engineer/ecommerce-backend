import express from 'express';
import {
  registerUser,
  loginUser,
  logout,
  logoutAll,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getUserProfile,
  updateUserProfile,
  getLoginHistory,
  revokeDevice,
  googleLogin,
  setupMFA,
  verifyMFA,
  disableMFA
} from '../controllers/authController.js';
import { protect, admin, requireVerifiedEmail } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validation/schemas.js';

const router = express.Router();

// Public routes
router.post('/register', validateBody(registerSchema), registerUser);
router.post('/login', validateBody(loginSchema), loginUser);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/google', googleLogin);

// Protected routes
router.use(protect);

// Authentication
router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.post('/resend-verification', resendVerification);
router.post('/change-password', validateBody(changePasswordSchema), changePassword);

// Profile
router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile);

// Security
router.get('/login-history', getLoginHistory);
router.delete('/devices/:deviceId', revokeDevice);

// MFA
router.post('/mfa/setup', setupMFA);
router.post('/mfa/verify', verifyMFA);
router.post('/mfa/disable', disableMFA);

export default router;
