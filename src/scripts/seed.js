import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Coupon from '../models/Coupon.js';
import { ShippingZone, ShippingMethod } from '../models/Shipping.js';
import Warehouse from '../models/Warehouse.js';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce');
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    process.exit(1);
  }
};

const seedDatabase = async () => {
  try {
    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({}),
      Product.deleteMany({}),
      Coupon.deleteMany({}),
      ShippingZone.deleteMany({}),
      ShippingMethod.deleteMany({}),
      Warehouse.deleteMany({})
    ]);

    console.log('[Seed] Cleared existing data');

    // Create Admin User
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@ansartehzeeb.com',
      password: 'AdminPass123',
      role: 'super_admin',
      isVerified: true,
      permissions: [
        'manage_products', 'manage_orders', 'manage_users', 'manage_categories',
        'manage_coupons', 'manage_inventory', 'view_analytics', 'manage_settings',
        'process_refunds', 'manage_support', 'view_reports', 'manage_shipping'
      ]
    });

    console.log('[Seed] Created admin user');

    // Create Brands
    const brands = await Brand.insertMany([
      { name: 'Aura', slug: 'aura', description: 'Premium lifestyle brand', isFeatured: true },
      { name: 'Glow', slug: 'glow', description: 'Skincare and beauty', isFeatured: true },
      { name: 'Luxor', slug: 'luxor', description: 'Luxury accessories', isFeatured: true },
      { name: 'Artisan', slug: 'artisan', description: 'Handcrafted goods' }
    ]);

    console.log('[Seed] Created brands');

    // Create Categories
    const electronics = await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Latest gadgets and electronics'
    });

    const watches = await Category.create({
      name: 'Watches',
      slug: 'watches',
      description: 'Premium timepieces',
      parentCategory: electronics._id
    });

    const fashion = await Category.create({
      name: 'Fashion',
      slug: 'fashion',
      description: 'Designer clothing and accessories'
    });

    const accessories = await Category.create({
      name: 'Accessories',
      slug: 'accessories',
      description: 'Premium accessories',
      parentCategory: fashion._id
    });

    const skincare = await Category.create({
      name: 'Skincare',
      slug: 'skincare',
      description: 'Premium skincare products'
    });

    const homeDecor = await Category.create({
      name: 'Home Decor',
      slug: 'home-decor',
      description: 'Luxury home decorations'
    });

    console.log('[Seed] Created categories');

    // Create Products
    const products = await Product.insertMany([
      {
        title: 'Chronograph Gold Watch',
        slug: 'chronograph-gold-watch',
        shortDescription: 'Premium gold chronograph watch',
        description: 'Experience precision engineering with our Chronograph Gold Watch. Crafted with authentic obsidian and gold trim, this timepiece represents the pinnacle of luxury horology. Water-resistant to 100m with sapphire crystal glass.',
        price: 349.00,
        compareAtPrice: 449.00,
        costPrice: 150.00,
        category: watches._id,
        brand: brands[0]._id,
        inventory: 50,
        lowStockAlertThreshold: 5,
        images: [
          { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', isPrimary: true },
          { url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800' }
        ],
        specifications: [
          { name: 'Movement', value: 'Swiss Quartz', group: 'Technical' },
          { name: 'Case', value: 'Stainless Steel with Gold Plating', group: 'Materials' },
          { name: 'Water Resistance', value: '100m', group: 'Technical' }
        ],
        isFeatured: true,
        isNewArrival: true,
        status: 'active',
        weight: 0.2,
        sku: 'CHG-WT-001'
      },
      {
        title: 'Minimalist Leather Wallet',
        slug: 'minimalist-leather-wallet',
        shortDescription: 'Sleek wallet crafted from full-grain leather',
        description: 'Premium full-grain leather wallet with minimalist design. Features RFID blocking technology and holds up to 8 cards plus cash.',
        price: 89.00,
        compareAtPrice: 0,
        category: accessories._id,
        brand: brands[3]._id,
        inventory: 150,
        lowStockAlertThreshold: 10,
        images: [
          { url: 'https://images.unsplash.com/photo-1627124765135-5667c7d19c84?w=800', isPrimary: true }
        ],
        specifications: [
          { name: 'Material', value: 'Full-Grain Italian Leather', group: 'Materials' },
          { name: 'Capacity', value: '8 Cards + Cash', group: 'Features' }
        ],
        isFeatured: true,
        status: 'active',
        weight: 0.1,
        sku: 'MIN-WA-001'
      },
      {
        title: 'Nordic Ceramic Mug Set',
        slug: 'nordic-ceramic-mug-set',
        shortDescription: 'Handmade ceramic mugs with stone matte finish',
        description: 'Set of 4 handmade ceramic mugs featuring a stunning stone matte finish. Perfect for coffee connoisseurs.',
        price: 64.00,
        compareAtPrice: 79.00,
        category: homeDecor._id,
        brand: brands[3]._id,
        inventory: 75,
        lowStockAlertThreshold: 8,
        images: [
          { url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800', isPrimary: true }
        ],
        specifications: [
          { name: 'Capacity', value: '350ml each', group: 'Specifications' },
          { name: 'Material', value: 'High-Fired Ceramic', group: 'Materials' }
        ],
        status: 'active',
        weight: 1.2,
        sku: 'NOR-MG-001'
      },
      {
        title: 'Premium Skincare Set',
        slug: 'premium-skincare-set',
        shortDescription: 'Complete skincare routine in one set',
        description: 'Luxurious 5-piece skincare set including cleanser, toner, serum, moisturizer, and eye cream. Made with natural ingredients.',
        price: 199.00,
        compareAtPrice: 279.00,
        category: skincare._id,
        brand: brands[1]._id,
        inventory: 40,
        lowStockAlertThreshold: 5,
        images: [
          { url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800', isPrimary: true }
        ],
        specifications: [
          { name: 'Pieces', value: '5', group: 'Contents' },
          { name: 'Skin Type', value: 'All Types', group: 'Features' }
        ],
        isFeatured: true,
        isNewArrival: true,
        status: 'active',
        weight: 0.8,
        sku: 'PREM-SK-001'
      },
      {
        title: 'Designer Sunglasses',
        slug: 'designer-sunglasses',
        shortDescription: 'UV400 protection with titanium frame',
        description: 'Premium designer sunglasses with polarized lenses and lightweight titanium frame. Includes premium leather case.',
        price: 249.00,
        compareAtPrice: 0,
        category: accessories._id,
        brand: brands[2]._id,
        inventory: 30,
        lowStockAlertThreshold: 5,
        images: [
          { url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800', isPrimary: true }
        ],
        specifications: [
          { name: 'Lens', value: 'Polarized UV400', group: 'Technical' },
          { name: 'Frame', value: 'Titanium', group: 'Materials' }
        ],
        status: 'active',
        weight: 0.05,
        sku: 'DES-SG-001'
      }
    ]);

    console.log('[Seed] Created products');

    // Create Coupons
    await Coupon.insertMany([
      {
        code: 'FIRST20',
        discountType: 'percentage',
        discountAmount: 20,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        maxUses: 1000,
        usedCount: 0,
        minPurchaseAmount: 50,
        isActive: true
      },
      {
        code: 'SAVE10',
        discountType: 'fixed',
        discountAmount: 10,
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        maxUses: 500,
        usedCount: 0,
        minPurchaseAmount: 100,
        isActive: true
      },
      {
        code: 'FREESHIP',
        discountType: 'fixed',
        discountAmount: 0,
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        maxUses: 200,
        usedCount: 0,
        isActive: true
      }
    ]);

    console.log('[Seed] Created coupons');

    // Create Shipping Zones
    const usZone = await ShippingZone.create({
      name: 'United States',
      countries: ['US'],
      isActive: true
    });

    const internationalZone = await ShippingZone.create({
      name: 'International',
      countries: ['CA', 'UK', 'AU', 'DE', 'FR'],
      isActive: true
    });

    // Create Shipping Methods
    await ShippingMethod.insertMany([
      {
        name: 'Standard Shipping',
        code: 'STANDARD',
        zones: [usZone._id],
        pricingType: 'flat',
        baseCost: 5.99,
        freeShippingThreshold: 75,
        estimatedDeliveryDays: { min: 5, max: 7 },
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Express Shipping',
        code: 'EXPRESS',
        zones: [usZone._id],
        pricingType: 'flat',
        baseCost: 12.99,
        estimatedDeliveryDays: { min: 2, max: 3 },
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'International Standard',
        code: 'INT_STD',
        zones: [internationalZone._id],
        pricingType: 'weight_based',
        baseCost: 15.99,
        weightRates: [
          { minWeight: 0, maxWeight: 1, cost: 15.99 },
          { minWeight: 1, maxWeight: 3, cost: 24.99 },
          { minWeight: 3, maxWeight: 10, cost: 39.99 }
        ],
        estimatedDeliveryDays: { min: 10, max: 21 },
        isActive: true,
        sortOrder: 3
      }
    ]);

    console.log('[Seed] Created shipping zones and methods');

    // Create Warehouse
    await Warehouse.create({
      name: 'Main Distribution Center',
      code: 'MDC',
      address: {
        street: '123 Commerce Way',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'US'
      },
      isActive: true,
      isDefault: true
    });

    console.log('[Seed] Created warehouse');

    console.log('\n[Seed] ✅ Database seeded successfully!');
    console.log('[Seed] Admin credentials: admin@ansartehzeeb.com / AdminPass123');
    
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

// Run seed
connectDB().then(seedDatabase);
