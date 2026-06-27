import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';

// Get products with search, filter, sort and pagination
export const getProducts = async (req, res, next) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 12;
    const page = parseInt(req.query.page) || 1;

    const query = {};

    // 1. Text Search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // 2. Category Filter
    if (req.query.category) {
      // Find category first (could be ID or slug)
      let cat = await Category.findOne({
        $or: [
          { _id: req.query.category.match(/^[0-9a-fA-F]{24}$/) ? req.query.category : null },
          { slug: req.query.category }
        ].filter(Boolean)
      });
      
      if (cat) {
        // Support finding products in subcategories too
        const subCats = await Category.find({ parentCategory: cat._id });
        const catIds = [cat._id, ...subCats.map(c => c._id)];
        query.category = { $in: catIds };
      }
    }

    // 3. Price Filter
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    // 4. Featured Filter
    if (req.query.featured) {
      query.isFeatured = req.query.featured === 'true';
    }

    // Sort options
    let sort = {};
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'priceAsc':
          sort = { price: 1 };
          break;
        case 'priceDesc':
          sort = { price: -1 };
          break;
        case 'rating':
          sort = { ratings: -1 };
          break;
        case 'newest':
        default:
          sort = { createdAt: -1 };
          break;
      }
    } else {
      sort = { createdAt: -1 };
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort(sort)
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      success: true,
      products,
      page,
      pages: Math.ceil(count / pageSize),
      totalProducts: count
    });
  } catch (error) {
    next(error);
  }
};

// Get product by slug
export const getProductBySlug = async (req, res, next) => {
  const { slug } = req.params;
  try {
    const product = await Product.findOne({ slug }).populate('category', 'name slug');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Populate reviews
    const reviews = await Review.find({ product: product._id })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      product,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

// Create product review
export const createProductReview = async (req, res, next) => {
  const { rating, title, comment } = req.body;
  const { slug } = req.params;

  try {
    const product = await Product.findOne({ slug });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const alreadyReviewed = await Review.findOne({
      product: product._id,
      user: req.user._id
    });

    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: 'Product already reviewed by you' });
    }

    const review = await Review.create({
      product: product._id,
      user: req.user._id,
      name: req.user.name,
      rating,
      title,
      comment
    });

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};
