import inventoryService from '../services/InventoryService.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import StockMovement from '../models/StockMovement.js';

/**
 * Get inventory status for a product
 */
export const getProductInventory = async (req, res, next) => {
  const { productId } = req.params;

  try {
    const status = await inventoryService.getInventoryStatus(productId);
    res.json({ success: true, ...status });
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust inventory (Admin/Inventory Manager)
 */
export const adjustInventory = async (req, res, next) => {
  const { productId } = req.params;
  const { newQuantity, reason } = req.body;

  try {
    const result = await inventoryService.adjustStock(
      productId,
      newQuantity,
      reason,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk adjust inventory
 */
export const bulkAdjustInventory = async (req, res, next) => {
  const { updates } = req.body; // Array of { productId, newQuantity, reason }

  try {
    const results = await inventoryService.bulkUpdateStock(updates, req.user._id);

    res.json({
      success: true,
      results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory summary (Admin)
 */
export const getInventorySummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (req, res, next) => {
  const { threshold } = req.query;

  try {
    const products = await Product.find({
      status: 'active',
      trackInventory: true,
      $expr: {
        $lte: ['$inventory', { $ifNull: [threshold ? parseInt(threshold) : '$lowStockAlertThreshold', '$lowStockAlertThreshold'] }]
      }
    })
    .select('title sku inventory lowStockAlertThreshold images')
    .sort({ inventory: 1 });

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

/**
 * Get out of stock products
 */
export const getOutOfStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      status: 'active',
      trackInventory: true,
      inventory: { $lte: 0 }
    })
    .select('title sku inventory images')
    .sort({ title: 1 });

    res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock movements for a product
 */
export const getStockMovements = async (req, res, next) => {
  const { productId } = req.params;
  const { page = 1, limit = 20, type } = req.query;

  try {
    const query = { product: productId };
    if (type) query.type = type;

    const movements = await StockMovement.find(query)
      .populate('performedBy', 'name')
      .populate('warehouse', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockMovement.countDocuments(query);

    res.json({
      success: true,
      movements,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add stock (purchase/restock)
 */
export const addStock = async (req, res, next) => {
  const { productId } = req.params;
  const { quantity, unitCost, reason, warehouseId } = req.body;

  try {
    const result = await inventoryService.addStock(productId, quantity, 'purchase', {
      unitCost,
      reason,
      warehouseId,
      userId: req.user._id,
      referenceType: 'purchase_order'
    });

    res.json({
      success: true,
      message: 'Stock added successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer stock between warehouses
 */
export const transferStock = async (req, res, next) => {
  const { productId } = req.params;
  const { fromWarehouseId, toWarehouseId, quantity } = req.body;

  try {
    const product = await inventoryService.transferStock(
      productId,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      req.user._id
    );

    res.json({
      success: true,
      message: 'Stock transferred successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all warehouses
 */
export const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find()
      .sort({ isDefault: -1, name: 1 });

    res.json({ success: true, warehouses });
  } catch (error) {
    next(error);
  }
};

/**
 * Create warehouse
 */
export const createWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Warehouse created successfully',
      warehouse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update warehouse
 */
export const updateWarehouse = async (req, res, next) => {
  const { id } = req.params;

  try {
    const warehouse = await Warehouse.findByIdAndUpdate(id, req.body, { new: true });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      warehouse
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete warehouse
 */
export const deleteWarehouse = async (req, res, next) => {
  const { id } = req.params;

  try {
    const warehouse = await Warehouse.findByIdAndDelete(id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      message: 'Warehouse deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
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
};
