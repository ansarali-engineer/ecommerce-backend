import Wishlist from '../models/Wishlist.js';
import Cart from '../models/Cart.js';

// Get Wishlist
export const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products', 'title price images inventory slug');
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }
    res.json({ success: true, wishlist });
  } catch (error) {
    next(error);
  }
};

// Add to Wishlist
export const addToWishlist = async (req, res, next) => {
  const { productId } = req.body;
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    if (wishlist.products.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Product already in wishlist' });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    const updated = await Wishlist.findOne({ user: req.user._id }).populate('products', 'title price images inventory slug');
    res.json({ success: true, wishlist: updated });
  } catch (error) {
    next(error);
  }
};

// Remove from Wishlist
export const removeFromWishlist = async (req, res, next) => {
  const { productId } = req.params;
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
    await wishlist.save();

    const updated = await Wishlist.findOne({ user: req.user._id }).populate('products', 'title price images inventory slug');
    res.json({ success: true, wishlist: updated });
  } catch (error) {
    next(error);
  }
};

// Move wishlist item to cart
export const moveToCart = async (req, res, next) => {
  const { productId } = req.body;
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist || !wishlist.products.includes(productId)) {
      return res.status(404).json({ success: false, message: 'Product not found in wishlist' });
    }

    // Remove from wishlist
    wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
    await wishlist.save();

    // Add to cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += 1;
    } else {
      cart.items.push({ product: productId, quantity: 1 });
    }
    await cart.save();

    const updatedWishlist = await Wishlist.findOne({ user: req.user._id }).populate('products', 'title price images inventory slug');
    res.json({
      success: true,
      message: 'Moved to cart successfully',
      wishlist: updatedWishlist
    });
  } catch (error) {
    next(error);
  }
};
