import Coupon from '../models/Coupon.js';

// Validate Coupon
export const validateCoupon = async (req, res, next) => {
  const { code, purchaseAmount } = req.body;

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon code not found' });
    }

    if (!coupon.isValid(purchaseAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is inactive, expired, limit reached, or minimum purchase amount not met'
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (purchaseAmount * coupon.discountAmount) / 100;
    } else {
      discount = coupon.discountAmount;
    }

    // Cap discount at purchase amount
    discount = Math.min(discount, purchaseAmount);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount
      },
      discount
    });
  } catch (error) {
    next(error);
  }
};
