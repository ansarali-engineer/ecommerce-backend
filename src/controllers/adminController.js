import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';

// ================= PRODUCT MANAGEMENT =================

// Add Product
export const addProduct = async (req, res, next) => {
  const { title, description, price, compareAtPrice, category, inventory, lowStockAlertThreshold, images, isFeatured, specifications } = req.body;
  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check slug collision
    const existing = await Product.findOne({ slug });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const product = await Product.create({
      title,
      slug: finalSlug,
      description,
      price,
      compareAtPrice,
      category,
      inventory,
      lowStockAlertThreshold,
      images,
      isFeatured,
      specifications
    });

    res.status(201).json({ success: true, message: 'Product added successfully', product });
  } catch (error) {
    next(error);
  }
};

// Edit Product
export const editProduct = async (req, res, next) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.body.title && req.body.title !== product.title) {
      const slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = await Product.findOne({ slug });
      product.slug = existing ? `${slug}-${Date.now()}` : slug;
    }

    Object.assign(product, req.body);
    await product.save();

    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    next(error);
  }
};

// Delete Product
export const deleteProduct = async (req, res, next) => {
  const { id } = req.params;
  try {
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Bulk upload products (Mock)
export const bulkUploadProducts = async (req, res, next) => {
  const { products } = req.body; // array of products
  try {
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Invalid payload: products list must be an array' });
    }

    const preparedProducts = products.map(p => {
      const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return {
        ...p,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`
      };
    });

    const result = await Product.insertMany(preparedProducts);
    res.status(201).json({ success: true, message: `${result.length} products uploaded successfully`, count: result.length });
  } catch (error) {
    next(error);
  }
};

// ================= CATEGORY MANAGEMENT =================

// Create Category
export const createCategory = async (req, res, next) => {
  const { name, description, parentCategory } = req.body;
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const category = await Category.create({ name, slug, description, parentCategory });
    res.status(201).json({ success: true, message: 'Category created successfully', category });
  } catch (error) {
    next(error);
  }
};

// Edit Category
export const editCategory = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (req.body.name && req.body.name !== category.name) {
      category.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    Object.assign(category, req.body);
    await category.save();

    res.json({ success: true, message: 'Category updated successfully', category });
  } catch (error) {
    next(error);
  }
};

// Delete Category
export const deleteCategory = async (req, res, next) => {
  const { id } = req.params;
  try {
    // Check if category has subcategories or products linked
    const subcats = await Category.countDocuments({ parentCategory: id });
    if (subcats > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete category. It contains subcategories.' });
    }

    const linkedProducts = await Product.countDocuments({ category: id });
    if (linkedProducts > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete category. Products are linked to it.' });
    }

    await Category.findByIdAndDelete(id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ================= ORDER MANAGEMENT =================

// View all orders (Admin)
export const getAllOrders = async (req, res, next) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 20;
    const page = parseInt(req.query.page) || 1;

    const count = await Order.countDocuments({});
    const orders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      success: true,
      orders,
      page,
      pages: Math.ceil(count / pageSize),
      totalOrders: count
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (Admin)
export const updateOrderStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // e.g. Processing, Shipped, Delivered

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.orderStatus = status;
    
    if (status === 'Delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    await order.save();
    res.json({ success: true, message: `Order status updated to ${status} successfully`, order });
  } catch (error) {
    next(error);
  }
};

// Process Refund (Admin Mock)
export const processRefund = async (req, res, next) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.isPaid) {
      return res.status(400).json({ success: false, message: 'Cannot refund an unpaid order' });
    }

    if (order.orderStatus === 'Refunded') {
      return res.status(400).json({ success: false, message: 'Order is already refunded' });
    }

    // Refund stock back
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { inventory: item.quantity }
      });
    }

    order.orderStatus = 'Refunded';
    await order.save();

    res.json({ success: true, message: 'Order refund processed successfully. Stock replenished.', order });
  } catch (error) {
    next(error);
  }
};

// ================= CUSTOMER LOGS / MANAGEMENT =================

// Get Users (Admin)
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-verificationToken -resetPasswordToken');
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

// ================= ANALYTICS DASHBOARD =================

// Get Dashboard Stats (Admin)
export const getDashboardStats = async (req, res, next) => {
  try {
    // 1. Total revenue
    const revenueData = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalSales: { $sum: '$totalPrice' } } }
    ]);
    const totalSales = revenueData[0]?.totalSales || 0;

    // 2. Sales and Orders counts
    const ordersCount = await Order.countDocuments({});
    const usersCount = await User.countDocuments({ role: 'customer' });
    const productsCount = await Product.countDocuments({});

    // 3. Low stock alerts
    const lowStockAlerts = await Product.find({
      $expr: { $lte: ['$inventory', '$lowStockAlertThreshold'] }
    }).select('title inventory lowStockAlertThreshold');

    // 4. Category breakdown (Sales per category)
    const categorySales = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      { $unwind: '$categoryDetails' },
      {
        $group: {
          _id: '$categoryDetails.name',
          sales: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
        }
      },
      { $sort: { sales: -1 } }
    ]);

    // 5. Best Selling Products
    const bestSellers = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          title: { $first: '$orderItems.title' },
          image: { $first: '$orderItems.image' },
          quantitySold: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 }
    ]);

    // 6. 30-Day Sales trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesTrend = await Order.aggregate([
      {
        $match: {
          isPaid: true,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: '$totalPrice' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalSales,
        ordersCount,
        usersCount,
        productsCount,
        lowStockCount: lowStockAlerts.length,
        lowStockAlerts,
        categorySales,
        bestSellers,
        salesTrend
      }
    });
  } catch (error) {
    next(error);
  }
};
