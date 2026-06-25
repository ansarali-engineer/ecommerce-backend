import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

// Protect routes - Verify JWT Token
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Not authorized, user not found' 
        });
      }

      // Check if user is active
      if (req.user.status !== 'active') {
        return res.status(403).json({ 
          success: false, 
          message: 'Account is suspended or inactive' 
        });
      }

      // Check if account is locked
      if (req.user.isLocked) {
        return res.status(403).json({ 
          success: false, 
          message: 'Account is temporarily locked due to too many failed login attempts' 
        });
      }

      next();
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token failed' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, no token provided' 
    });
  }
};

// Admin middleware - Verify role
export const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin role required.' 
    });
  }
};

// Super admin middleware
export const superAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Access denied. Super admin role required.' 
    });
  }
};

// Role-based permission middleware
export const hasPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authenticated' 
      });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every(perm => 
      req.user.permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Check role middleware
export const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authenticated' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient role privileges.' 
      });
    }

    next();
  };
};

// Verify email middleware
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Email verification required' 
    });
  }
  next();
};

// Check if user owns resource or is admin
export const ownerOrAdmin = (resourceField = 'user') => {
  return (req, res, next) => {
    const resourceUserId = req.resource?.[resourceField]?.toString() || 
                           req.body?.[resourceField]?.toString() ||
                           req.params?.userId;
    
    const isOwner = resourceUserId && resourceUserId === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (isOwner || isAdmin) {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. You can only access your own resources.' 
    });
  };
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token invalid, but continue without user
      req.user = null;
    }
  }

  next();
};

// Audit logging middleware
export const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;
    
    res.end = function(chunk, encoding) {
      // Restore original end
      res.end = originalEnd;
      
      // Create audit log after response
      if (req.user) {
        AuditLog.create({
          user: req.user._id,
          userName: req.user.name,
          userEmail: req.user.email,
          action: action,
          resourceType: resourceType,
          resourceId: req.params.id || req.params.slug,
          description: `${action} ${resourceType}`,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl,
          status: res.statusCode < 400 ? 'success' : 'failure'
        }).catch(err => console.error('Audit log error:', err));
      }
      
      return res.end(chunk, encoding);
    };
    
    next();
  };
};

// Rate limiting per user
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) return next();
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or initialize user requests
    let userRequests = requests.get(userId) || [];
    
    // Filter out old requests
    userRequests = userRequests.filter(time => time > windowStart);
    
    // Check limit
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

// MFA verification middleware
export const requireMFA = async (req, res, next) => {
  if (!req.user.mfa.enabled) {
    return next();
  }
  
  const mfaToken = req.headers['x-mfa-token'];
  
  if (!mfaToken) {
    return res.status(403).json({
      success: false,
      message: 'MFA verification required',
      requireMFA: true
    });
  }
  
  // Verify MFA token (implementation depends on MFA method)
  // This would integrate with speakeasy for TOTP or similar
  next();
};

export default {
  protect,
  admin,
  superAdmin,
  hasPermission,
  hasRole,
  requireVerifiedEmail,
  ownerOrAdmin,
  optionalAuth,
  auditLog,
  userRateLimit,
  requireMFA
};
