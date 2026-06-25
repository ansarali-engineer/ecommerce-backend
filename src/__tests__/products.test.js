import request from 'supertest';
import app from '../app.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

describe('Product Endpoints', () => {
  let adminToken;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/ecommerce_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    // Create admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'AdminPass123'
      });
    
    await User.findByIdAndUpdate(adminResponse.body.user._id, { role: 'admin' });
    adminToken = adminResponse.body.token;

    // Create test category
    testCategory = await Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category description'
    });

    // Create test product
    testProduct = await Product.create({
      title: 'Test Product',
      slug: 'test-product',
      description: 'Test product description',
      price: 99.99,
      category: testCategory._id,
      inventory: 100,
      images: ['https://example.com/image.jpg'],
      status: 'active'
    });
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].title).toBe('Test Product');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get(`/api/products?category=${testCategory.slug}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.products).toHaveLength(1);
    });

    it('should search products by text', async () => {
      const response = await request(app)
        .get('/api/products?search=Test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.products.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      // Create multiple products
      for (let i = 0; i < 15; i++) {
        await Product.create({
          title: `Product ${i}`,
          slug: `product-${i}`,
          description: 'Description',
          price: 10 + i,
          category: testCategory._id,
          inventory: 10,
          images: ['https://example.com/image.jpg'],
          status: 'active'
        });
      }

      const response = await request(app)
        .get('/api/products?pageSize=5&page=1')
        .expect(200);

      expect(response.body.products).toHaveLength(5);
      expect(response.body.pages).toBeGreaterThan(1);
    });
  });

  describe('GET /api/products/:slug', () => {
    it('should return product by slug', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.slug}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.product.title).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-product')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/products/:slug/reviews', () => {
    let userToken;

    beforeEach(async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Review User',
          email: 'review@example.com',
          password: 'ReviewPass123'
        });
      
      userToken = userResponse.body.token;
    });

    it('should create a review for a product', async () => {
      const response = await request(app)
        .post(`/api/products/${testProduct.slug}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          title: 'Great Product',
          comment: 'This is an excellent product!'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.review.rating).toBe(5);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post(`/api/products/${testProduct.slug}/reviews`)
        .send({
          rating: 5,
          title: 'Great Product',
          comment: 'This is an excellent product!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should prevent duplicate reviews from same user', async () => {
      // First review
      await request(app)
        .post(`/api/products/${testProduct.slug}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 5,
          title: 'Great Product',
          comment: 'This is an excellent product!'
        });

      // Second review (should fail)
      const response = await request(app)
        .post(`/api/products/${testProduct.slug}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 4,
          title: 'Another Review',
          comment: 'This is another review'
        })
        .expect(400);

      expect(response.body.message).toBe('Product already reviewed by you');
    });
  });
});

describe('Product Model', () => {
  it('should calculate discount percentage correctly', () => {
    const product = new Product({
      title: 'Discounted Product',
      slug: 'discounted-product',
      price: 80,
      compareAtPrice: 100
    });

    expect(product.discountPercentage).toBe(20);
  });

  it('should handle out of stock products', () => {
    const product = new Product({
      title: 'Out of Stock',
      slug: 'out-of-stock',
      price: 50,
      inventory: 0,
      trackInventory: true
    });

    expect(product.inStock).toBe(false);
  });

  it('should allow backorders when configured', () => {
    const product = new Product({
      title: 'Backorder Product',
      slug: 'backorder-product',
      price: 50,
      inventory: 0,
      trackInventory: true,
      allowBackorders: true
    });

    expect(product.inStock).toBe(true);
  });
});
