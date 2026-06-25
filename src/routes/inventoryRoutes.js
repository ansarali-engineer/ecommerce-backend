import express from 'express';
import {
  getProductInventory,
  adjustInventory,
  bulkAdjustInventory,
  getInventorySummary,
  getLowStockProducts,
  getOutOfStockProducts,
  getStockMovements,
  addStock,
  transferStock,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} from '../controllers/inventoryController.js';
import { protect, admin, hasPermission, hasRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes
router.use(protect);

// Inventory summary and alerts
router.get('/summary', admin, getInventorySummary);
router.get('/low-stock', admin, getLowStockProducts);
router.get('/out-of-stock', admin, getOutOfStockProducts);

// Product-specific inventory
router.get('/:productId', getProductInventory);
router.get('/:productId/movements', getStockMovements);

// Inventory management (admin, inventory_manager)
router.put('/:productId/adjust', 
  hasRole('admin', 'super_admin', 'inventory_manager'), 
  adjustInventory
);

router.post('/bulk-adjust', 
  hasRole('admin', 'super_admin', 'inventory_manager'), 
  bulkAdjustInventory
);

router.post('/:productId/add', 
  hasRole('admin', 'super_admin', 'inventory_manager'), 
  addStock
);

router.post('/:productId/transfer', 
  hasRole('admin', 'super_admin', 'inventory_manager'), 
  transferStock
);

// Warehouse management
router.get('/warehouses/all', getWarehouses);
router.post('/warehouses', admin, createWarehouse);
router.put('/warehouses/:id', admin, updateWarehouse);
router.delete('/warehouses/:id', admin, deleteWarehouse);

export default router;
