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
import { protect, admin, hasRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Inventory summary and alerts
router.get('/summary', admin, getInventorySummary);
router.get('/low-stock', admin, getLowStockProducts);
router.get('/out-of-stock', admin, getOutOfStockProducts);

// Warehouse management — static paths before /:productId
router.get('/warehouses/all', admin, getWarehouses);
router.post('/warehouses', admin, createWarehouse);
router.put('/warehouses/:id', admin, updateWarehouse);
router.delete('/warehouses/:id', admin, deleteWarehouse);

// Bulk operations
router.post('/bulk-adjust',
  hasRole('admin', 'super_admin', 'inventory_manager'),
  bulkAdjustInventory
);

// Product-specific inventory (admin only)
router.get('/:productId', admin, getProductInventory);
router.get('/:productId/movements', admin, getStockMovements);

router.put('/:productId/adjust',
  hasRole('admin', 'super_admin', 'inventory_manager'),
  adjustInventory
);

router.post('/:productId/add',
  hasRole('admin', 'super_admin', 'inventory_manager'),
  addStock
);

router.post('/:productId/transfer',
  hasRole('admin', 'super_admin', 'inventory_manager'),
  transferStock
);

export default router;
