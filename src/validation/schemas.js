import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().required().min(2).max(50).messages({
    'string.empty': 'Name cannot be empty',
    'string.min': 'Name must be at least 2 characters long'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Invalid email format'
  }),
  password: Joi.string()
    .min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&#^()_+\-=]{6,}$/)
    .required()
    .messages({
      'string.empty': 'Password cannot be empty',
      'string.min': 'Password must be at least 6 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  referralCode: Joi.string().allow('')
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email cannot be empty',
    'string.email': 'Invalid email format'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password cannot be empty'
  })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required'
  }),
  newPassword: Joi.string()
    .min(6)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&#^()_+\-=]{6,}$/)
    .required()
    .messages({
      'string.empty': 'New password cannot be empty',
      'string.min': 'New password must be at least 6 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  })
});

export const addressSchema = Joi.object({
  label: Joi.string().allow(''),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().required(),
  phone: Joi.string().allow(''),
  isDefault: Joi.boolean().default(false)
});

export const productSchema = Joi.object({
  title: Joi.string().required().min(2).max(200),
  shortDescription: Joi.string().max(300).allow(''),
  description: Joi.string().required().min(10),
  price: Joi.number().required().min(0),
  compareAtPrice: Joi.number().min(0).default(0),
  costPrice: Joi.number().min(0),
  category: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/, 'valid MongoDB ObjectId'),
  subcategory: Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'valid MongoDB ObjectId').allow(null),
  brand: Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'valid MongoDB ObjectId').allow(null),
  tags: Joi.array().items(Joi.string()),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      alt: Joi.string(),
      isPrimary: Joi.boolean(),
      order: Joi.number()
    })
  ).min(1).required(),
  videos: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      type: Joi.string().valid('youtube', 'vimeo', 'upload').required()
    })
  ),
  inventory: Joi.number().required().integer().min(0),
  lowStockAlertThreshold: Joi.number().integer().min(0).default(5),
  trackInventory: Joi.boolean().default(true),
  allowBackorders: Joi.boolean().default(false),
  sku: Joi.string().allow(null),
  barcode: Joi.string().allow(null),
  weight: Joi.number().min(0),
  dimensions: Joi.object({
    length: Joi.number(),
    width: Joi.number(),
    height: Joi.number(),
    unit: Joi.string().valid('cm', 'in').default('cm')
  }),
  specifications: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required(),
      group: Joi.string(),
      isHighlight: Joi.boolean()
    })
  ),
  faqs: Joi.array().items(
    Joi.object({
      question: Joi.string().required(),
      answer: Joi.string().required()
    })
  ),
  isFeatured: Joi.boolean().default(false),
  status: Joi.string().valid('draft', 'active', 'archived', 'discontinued').default('active'),
  visibility: Joi.string().valid('visible', 'hidden', 'search_only').default('visible'),
  taxClass: Joi.string().default('standard'),
  taxExempt: Joi.boolean().default(false),
  seo: Joi.object({
    metaTitle: Joi.string().max(60),
    metaDescription: Joi.string().max(160),
    metaKeywords: Joi.array().items(Joi.string()),
    canonicalUrl: Joi.string()
  })
});

export const reviewSchema = Joi.object({
  rating: Joi.number().required().integer().min(1).max(5),
  title: Joi.string().required().max(100),
  comment: Joi.string().required().max(1000)
});

export const orderSchema = Joi.object({
  orderItems: Joi.array().items(
    Joi.object({
      product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
      variant: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
      title: Joi.string().required(),
      quantity: Joi.number().required().integer().min(1),
      image: Joi.string().required(),
      price: Joi.number().required().min(0)
    })
  ).min(1).required(),
  shippingAddress: addressSchema.required(),
  billingAddress: addressSchema,
  paymentMethod: Joi.string().valid('Stripe', 'PayPal', 'Razorpay', 'CashOnDelivery').required(),
  shippingMethod: Joi.string(),
  taxPrice: Joi.number().min(0).required(),
  shippingPrice: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).default(0),
  couponCode: Joi.string(),
  giftCardCode: Joi.string(),
  totalPrice: Joi.number().min(0).required(),
  customerNotes: Joi.string().allow('')
});

export const couponSchema = Joi.object({
  code: Joi.string().required().uppercase().trim(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountAmount: Joi.number().min(0).required(),
  expiryDate: Joi.date().greater('now').required(),
  maxUses: Joi.number().integer().min(1).default(100),
  minPurchaseAmount: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0),
  applicableProducts: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  applicableCategories: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  isActive: Joi.boolean().default(true),
  isOneTimeUse: Joi.boolean().default(false)
});

export const categorySchema = Joi.object({
  name: Joi.string().required().min(2).max(50),
  description: Joi.string().allow('', null),
  parentCategory: Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'valid MongoDB ObjectId').allow(null),
  image: Joi.string().uri().allow(''),
  metaTitle: Joi.string().max(60),
  metaDescription: Joi.string().max(160)
});

export const brandSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().allow('').max(500),
  logo: Joi.string().uri().allow(''),
  banner: Joi.string().uri().allow(''),
  website: Joi.string().uri().allow(''),
  metaTitle: Joi.string().max(60),
  metaDescription: Joi.string().max(160),
  isFeatured: Joi.boolean().default(false)
});

export const returnRequestSchema = Joi.object({
  orderId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  returnReason: Joi.string().valid(
    'damaged', 'defective', 'wrong_item', 'not_as_described',
    'no_longer_needed', 'better_price_found', 'late_delivery', 'other'
  ).required(),
  returnReasonDetails: Joi.string().max(2000).allow(''),
  items: Joi.array().items(
    Joi.object({
      product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
      quantity: Joi.number().required().integer().min(1),
      reason: Joi.string().allow('')
    })
  ).min(1).required(),
  refundType: Joi.string().valid('original_payment', 'store_credit', 'exchange').default('original_payment'),
  customerNotes: Joi.string().max(2000).allow(''),
  photos: Joi.array().items(
    Joi.string().max(700000).custom((value, helpers) => {
      const isUrl = /^https?:\/\//i.test(value);
      const isDataUrl = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(value);
      if (!isUrl && !isDataUrl) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'image url or data uri')
  ).max(5)
});

export const returnActionSchema = Joi.object({
  adminNotes: Joi.string().max(2000).allow(''),
  customerFacingNote: Joi.string().max(2000).allow(''),
  internalNotes: Joi.string().max(2000).allow(''),
  returnShippingMethod: Joi.string().allow(''),
  returnShippingCost: Joi.number().min(0),
  returnShippingPaidBy: Joi.string().valid('customer', 'merchant')
});

export const processRefundSchema = Joi.object({
  refundAmount: Joi.number().min(0),
  internalNotes: Joi.string().max(2000).allow(''),
  customerFacingNote: Joi.string().max(2000).allow(''),
  restoreInventory: Joi.boolean().default(true)
});

export const returnInfoRequestSchema = Joi.object({
  customerFacingNote: Joi.string().required().min(10).max(2000),
  internalNotes: Joi.string().max(2000).allow('')
});

export const shippingZoneSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  countries: Joi.array().items(Joi.string()),
  states: Joi.array().items(Joi.string()),
  cities: Joi.array().items(Joi.string()),
  postalCodes: Joi.array().items(
    Joi.object({
      start: Joi.string(),
      end: Joi.string()
    })
  ),
  isActive: Joi.boolean().default(true)
});

export const shippingMethodSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  description: Joi.string().allow(''),
  zones: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)),
  pricingType: Joi.string().valid('flat', 'weight_based', 'price_based', 'quantity_based').default('flat'),
  baseCost: Joi.number().min(0).default(0),
  weightRates: Joi.array().items(
    Joi.object({
      minWeight: Joi.number(),
      maxWeight: Joi.number(),
      cost: Joi.number()
    })
  ),
  priceRates: Joi.array().items(
    Joi.object({
      minPrice: Joi.number(),
      maxPrice: Joi.number(),
      cost: Joi.number()
    })
  ),
  quantityRates: Joi.array().items(
    Joi.object({
      minQuantity: Joi.number(),
      maxQuantity: Joi.number(),
      cost: Joi.number()
    })
  ),
  freeShippingThreshold: Joi.number().min(0),
  estimatedDeliveryDays: Joi.object({
    min: Joi.number().integer().min(0),
    max: Joi.number().integer().min(0)
  }),
  maxWeight: Joi.number().min(0),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().default(0)
});

export const warehouseSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required()
  }).required(),
  contactPerson: Joi.string(),
  phone: Joi.string(),
  email: Joi.string().email(),
  capacity: Joi.number().min(0),
  isActive: Joi.boolean().default(true),
  isDefault: Joi.boolean().default(false)
});

export const flashSaleSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  startTime: Joi.date().greater('now').required(),
  endTime: Joi.date().greater(Joi.ref('startTime')).required(),
  products: Joi.array().items(
    Joi.object({
      product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
      variant: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
      salePrice: Joi.number().required().min(0),
      originalPrice: Joi.number().required().min(0),
      discount: Joi.number().min(0).max(100),
      maxQuantity: Joi.number().integer().min(1).allow(null),
      totalQuantity: Joi.number().integer().min(1)
    })
  ).min(1).required(),
  maxItemsPerUser: Joi.number().integer().min(1).default(5),
  bannerImage: Joi.string().uri().allow(''),
  bannerText: Joi.string().allow('')
});

export const giftCardSchema = Joi.object({
  initialBalance: Joi.number().required().min(1),
  recipientEmail: Joi.string().email().required(),
  recipientName: Joi.string().required(),
  message: Joi.string().allow(''),
  design: Joi.string(),
  theme: Joi.string().valid('birthday', 'holiday', 'general', 'custom').default('general'),
  deliveryMethod: Joi.string().valid('email', 'mail', 'in_store').default('email'),
  deliveryDate: Joi.date()
});

export const profileUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/),
  dateOfBirth: Joi.date().max('now'),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
  avatar: Joi.string().uri(),
  addresses: Joi.array().items(addressSchema),
  notificationPreferences: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean(),
    orderUpdates: Joi.boolean(),
    promotions: Joi.boolean(),
    newsletter: Joi.boolean()
  })
});

export const inventoryAdjustmentSchema = Joi.object({
  productId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  newQuantity: Joi.number().integer().min(0).required(),
  reason: Joi.string().required().min(5)
});
