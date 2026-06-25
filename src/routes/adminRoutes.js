import express from 'express';
import {
  addProduct,
  editProduct,
  deleteProduct,
  bulkUploadProducts,
  createCategory,
  editCategory,
  deleteCategory,
  getAllOrders,
  updateOrderStatus,
  processRefund,
  getAllUsers,
  getDashboardStats
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { productSchema, categorySchema, couponSchema } from '../validation/schemas.js';

const router = express.Router();

// Apply protect and admin to all routes here
router.use(protect, admin);

// Analytics
router.get('/stats', getDashboardStats);

// Products
router.post('/products', validateBody(productSchema), addProduct);
router.post('/products/bulk', bulkUploadProducts);
router.route('/products/:id')
  .put(validateBody(productSchema.fork(Object.keys(productSchema.describe().keys), (schema) => schema.optional())), editProduct)
  .delete(deleteProduct);

// Categories
router.post('/categories', validateBody(categorySchema), createCategory);
router.route('/categories/:id')
  .put(validateBody(categorySchema.fork(['name'], (schema) => schema.optional())), editCategory)
  .delete(deleteCategory);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/refund', processRefund);

// Users
router.get('/users', getAllUsers);

export default router;
