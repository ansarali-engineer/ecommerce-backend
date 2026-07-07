import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';

// Load environment variables early so any imported module can access them
dotenv.config();

// Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import flashSaleRoutes from './routes/flashSaleRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

// Middlewares & Config
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { withDB } from './middleware/db.js';
import swaggerSpec from './config/swagger.js';

const app = express();
app.use(withDB); // ← runs before every route, no need to call connectDB in each controller

// Enable CORS
app.use(cors({
  origin:'https://ecommerce-frontend-sable-zeta.vercel.app' || process.env.FRONTEND_URL,
  credentials: true
}));

// HTTP Security Headers
app.use(helmet());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Custom raw body parsing for Stripe webhook before express.json() is applied
app.use('/api/payments/stripe-webhook', express.raw({ type: 'application/json' }));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Prevent NoSQL query injection
app.use(mongoSanitize());

// XSS Protection
import xss from 'xss-clean';
app.use(xss());

// Rate Limiting (100 requests per 15 minutes for Auth/Payment routes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 12 attempts per hour
  message: {
    success: false,
    message: 'Too many login attempts, please try again after an hour'
  }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many contact form submissions, please try again later'
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', apiLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/payments', apiLimiter);
app.use('/api/contact', contactLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/flash-sales', flashSaleRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// 404 & Error Handler
app.use(notFound);
app.use(errorHandler);

export default app;
