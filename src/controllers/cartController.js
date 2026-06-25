import Cart from '../models/Cart.js';

// Get Cart
export const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'title price images inventory slug');
    
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    
    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// Add / Update item in Cart
export const addToCart = async (req, res, next) => {
  const { productId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      // Item exists, update quantity
      cart.items[itemIndex].quantity += Number(quantity);
    } else {
      // New item
      cart.items.push({ product: productId, quantity: Number(quantity) });
    }

    await cart.save();
    
    const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'title price images inventory slug');
    res.json({ success: true, cart: updatedCart });
  } catch (error) {
    next(error);
  }
};

// Update Item Quantity in Cart
export const updateCartItemQuantity = async (req, res, next) => {
  const { productId, quantity } = req.body;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    cart.items[itemIndex].quantity = Number(quantity);
    await cart.save();

    const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'title price images inventory slug');
    res.json({ success: true, cart: updatedCart });
  } catch (error) {
    next(error);
  }
};

// Remove from Cart
export const removeFromCart = async (req, res, next) => {
  const { productId } = req.params;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();

    const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'title price images inventory slug');
    res.json({ success: true, cart: updatedCart });
  } catch (error) {
    next(error);
  }
};

// Merge guest cart with logged-in user cart
export const mergeCart = async (req, res, next) => {
  const { guestCartItems } = req.body; // array of { product: id, quantity: n }

  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    if (Array.isArray(guestCartItems)) {
      guestCartItems.forEach(guestItem => {
        const itemIndex = cart.items.findIndex(item => item.product.toString() === guestItem.product);
        if (itemIndex > -1) {
          // Add guest quantity to user quantity or pick maximum
          cart.items[itemIndex].quantity += guestItem.quantity;
        } else {
          cart.items.push({ product: guestItem.product, quantity: guestItem.quantity });
        }
      });
      await cart.save();
    }

    const updatedCart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'title price images inventory slug');
    res.json({ success: true, cart: updatedCart });
  } catch (error) {
    next(error);
  }
};
