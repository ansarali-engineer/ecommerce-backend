import Category from '../models/Category.js';
import Product from '../models/Product.js';

// Get all categories with product counts
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).populate('parentCategory', 'name slug');
    
    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const subCategories = await Category.find({ parentCategory: category._id }).select('_id');
        const categoryIds = [category._id, ...subCategories.map((sub) => sub._id)];
        const productCount = await Product.countDocuments({
          category: { $in: categoryIds },
          status: 'active'
        });
        return {
          ...category.toObject(),
          productCount
        };
      })
    );
    
    res.json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

// Get category by slug
export const getCategoryBySlug = async (req, res, next) => {
  const { slug } = req.params;
  try {
    const category = await Category.findOne({ slug }).populate('parentCategory', 'name slug');
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};
