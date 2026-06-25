import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import Warehouse from '../models/Warehouse.js';
import notificationService from './NotificationService.js';
import User from '../models/User.js';

class InventoryService {
  /**
   * Reserve stock for an order
   */
  async reserveStock(orderId, orderItems, userId) {
    const movements = [];

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }

      // Check availability
      const availableStock = product.inventory - product.reservedInventory;
      if (availableStock < item.quantity && !product.allowBackorders) {
        throw new Error(`Insufficient stock for ${product.title}. Available: ${availableStock}`);
      }

      // Reserve the stock
      product.reservedInventory += item.quantity;
      await product.save();

      // Create stock movement record
      const movement = await StockMovement.create({
        product: product._id,
        type: 'reserved',
        quantity: -item.quantity,
        previousStock: product.inventory,
        newStock: product.inventory,
        referenceType: 'order',
        referenceId: orderId,
        performedBy: userId,
        reason: `Reserved for order ${orderId}`
      });

      movements.push(movement);
    }

    return movements;
  }

  /**
   * Release reserved stock (e.g., cancelled order)
   */
  async releaseReservedStock(orderId, orderItems, userId) {
    const movements = [];

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      
      if (!product) continue;

      // Release the reserved stock
      product.reservedInventory = Math.max(0, product.reservedInventory - item.quantity);
      await product.save();

      // Create stock movement record
      const movement = await StockMovement.create({
        product: product._id,
        type: 'unreserved',
        quantity: item.quantity,
        previousStock: product.inventory,
        newStock: product.inventory,
        referenceType: 'order',
        referenceId: orderId,
        performedBy: userId,
        reason: `Released from order ${orderId}`
      });

      movements.push(movement);
    }

    return movements;
  }

  /**
   * Deduct stock after payment
   */
  async deductStock(orderId, orderItems, userId) {
    const movements = [];

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      
      if (!product) continue;

      const previousStock = product.inventory;

      // Deduct actual stock
      product.inventory = Math.max(0, product.inventory - item.quantity);
      product.reservedInventory = Math.max(0, product.reservedInventory - item.quantity);
      
      // Update sales count
      product.totalSales += item.quantity;
      
      await product.save();

      // Create stock movement record
      const movement = await StockMovement.create({
        product: product._id,
        type: 'sale',
        quantity: -item.quantity,
        previousStock,
        newStock: product.inventory,
        referenceType: 'order',
        referenceId: orderId,
        performedBy: userId,
        reason: `Sold in order ${orderId}`,
        unitCost: product.costPrice,
        totalValue: product.costPrice ? product.costPrice * item.quantity : 0
      });

      movements.push(movement);

      // Check for low stock and notify
      await this.checkLowStockAlert(product);
    }

    return movements;
  }

  /**
   * Add stock (purchase, return, etc.)
   */
  async addStock(productId, quantity, type, options = {}) {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.inventory;
    product.inventory += quantity;
    await product.save();

    // Create stock movement
    const movement = await StockMovement.create({
      product: product._id,
      type: type, // 'purchase', 'return', 'adjustment', etc.
      quantity: quantity,
      previousStock,
      newStock: product.inventory,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      performedBy: options.userId,
      reason: options.reason,
      unitCost: options.unitCost,
      totalValue: options.unitCost ? options.unitCost * quantity : 0,
      warehouse: options.warehouseId
    });

    return { product, movement };
  }

  /**
   * Adjust stock (inventory count correction)
   */
  async adjustStock(productId, newQuantity, reason, userId) {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.inventory;
    const difference = newQuantity - previousStock;

    product.inventory = newQuantity;
    await product.save();

    // Create stock movement
    const movement = await StockMovement.create({
      product: product._id,
      type: 'adjustment',
      quantity: difference,
      previousStock,
      newStock,
      referenceType: 'adjustment',
      performedBy: userId,
      reason
    });

    // Check low stock alert
    await this.checkLowStockAlert(product);

    return { product, movement };
  }

  /**
   * Transfer stock between warehouses
   */
  async transferStock(productId, fromWarehouseId, toWarehouseId, quantity, userId) {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    // Check if product has warehouse-specific inventory
    if (!product.warehouseStock || product.warehouseStock.length === 0) {
      throw new Error('Product does not have warehouse-specific inventory tracking');
    }

    const fromWarehouse = product.warehouseStock.find(
      w => w.warehouse.toString() === fromWarehouseId
    );
    const toWarehouse = product.warehouseStock.find(
      w => w.warehouse.toString() === toWarehouseId
    );

    if (!fromWarehouse || fromWarehouse.quantity < quantity) {
      throw new Error('Insufficient stock in source warehouse');
    }

    // Update warehouse quantities
    fromWarehouse.quantity -= quantity;
    if (toWarehouse) {
      toWarehouse.quantity += quantity;
    } else {
      product.warehouseStock.push({
        warehouse: toWarehouseId,
        quantity
      });
    }

    await product.save();

    // Create stock movements
    await StockMovement.create([
      {
        product: product._id,
        type: 'transfer_out',
        quantity: -quantity,
        previousStock: fromWarehouse.quantity + quantity,
        newStock: fromWarehouse.quantity,
        referenceType: 'transfer',
        performedBy: userId,
        sourceWarehouse: fromWarehouseId,
        destinationWarehouse: toWarehouseId
      },
      {
        product: product._id,
        type: 'transfer_in',
        quantity,
        previousStock: toWarehouse ? toWarehouse.quantity - quantity : 0,
        newStock: toWarehouse ? toWarehouse.quantity : quantity,
        referenceType: 'transfer',
        performedBy: userId,
        sourceWarehouse: fromWarehouseId,
        destinationWarehouse: toWarehouseId
      }
    ]);

    return product;
  }

  /**
   * Check low stock and send alerts
   */
  async checkLowStockAlert(product) {
    if (product.inventory <= product.lowStockAlertThreshold) {
      // Get admin users to notify
      const adminUsers = await User.find({
        role: { $in: ['admin', 'super_admin', 'inventory_manager'] }
      }).select('_id email name');

      if (adminUsers.length > 0) {
        await notificationService.notifyLowStock(product, adminUsers);
      }

      return true;
    }
    return false;
  }

  /**
   * Get inventory status for a product
   */
  async getInventoryStatus(productId) {
    const product = await Product.findById(productId)
      .populate('warehouseStock.warehouse');

    if (!product) {
      throw new Error('Product not found');
    }

    // Get recent movements
    const recentMovements = await StockMovement.find({ product: productId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('performedBy', 'name');

    // Calculate inventory metrics
    const totalReserved = product.reservedInventory;
    const availableStock = product.inventory - totalReserved;
    const stockStatus = product.inventory <= product.lowStockAlertThreshold 
      ? (product.inventory === 0 ? 'out_of_stock' : 'low_stock')
      : 'in_stock';

    return {
      product: {
        _id: product._id,
        title: product.title,
        sku: product.sku
      },
      inventory: product.inventory,
      reservedInventory: totalReserved,
      availableStock,
      lowStockThreshold: product.lowStockAlertThreshold,
      stockStatus,
      allowBackorders: product.allowBackorders,
      trackInventory: product.trackInventory,
      warehouseStock: product.warehouseStock,
      recentMovements
    };
  }

  /**
   * Get inventory summary for dashboard
   */
  async getInventorySummary() {
    const [
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue
    ] = await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ 
        status: 'active', 
        inventory: { $gt: 0 },
        $expr: { $gt: ['$inventory', '$lowStockAlertThreshold'] }
      }),
      Product.countDocuments({
        status: 'active',
        $expr: { 
          $and: [
            { $gt: ['$inventory', 0] },
            { $lte: ['$inventory', '$lowStockAlertThreshold'] }
          ]
        }
      }),
      Product.countDocuments({ 
        status: 'active', 
        inventory: { $lte: 0 } 
      }),
      Product.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalValue: {
              $sum: { $multiply: ['$inventory', { $ifNull: ['$costPrice', 0] }] }
            }
          }
        }
      ])
    ]);

    return {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryValue: totalValue[0]?.totalValue || 0
    };
  }

  /**
   * Bulk inventory update
   */
  async bulkUpdateStock(updates, userId) {
    const results = [];

    for (const update of updates) {
      try {
        const result = await this.adjustStock(
          update.productId,
          update.newQuantity,
          update.reason || 'Bulk inventory update',
          userId
        );
        results.push({
          productId: update.productId,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          productId: update.productId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default new InventoryService();
