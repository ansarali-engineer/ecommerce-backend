import { ShippingZone, ShippingMethod, Shipment } from '../models/Shipping.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

/**
 * Calculate shipping options for an order
 */
export const calculateShipping = async (req, res, next) => {
  const { items, shippingAddress } = req.body;

  try {
    // Validate shipping address
    if (!shippingAddress?.country || !shippingAddress?.state) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address with country and state is required'
      });
    }

    // Get all active shipping methods
    const shippingMethods = await ShippingMethod.find({ isActive: true })
      .populate('zones')
      .sort({ sortOrder: 1 });

    // Calculate order metrics
    const orderMetrics = await calculateOrderMetrics(items);

    // Filter and calculate rates for applicable methods
    const availableMethods = [];

    for (const method of shippingMethods) {
      // Check if method applies to the address
      const appliesToAddress = await methodAppliesToAddress(method, shippingAddress);
      
      if (!appliesToAddress) continue;

      // Calculate shipping cost based on pricing type
      const cost = calculateShippingCost(method, orderMetrics);

      // Check for free shipping
      const isFreeShipping = method.freeShippingThreshold && 
                             orderMetrics.subtotal >= method.freeShippingThreshold;

      availableMethods.push({
        _id: method._id,
        name: method.name,
        code: method.code,
        description: method.description,
        cost: isFreeShipping ? 0 : cost,
        originalCost: cost,
        isFreeShipping,
        estimatedDeliveryDays: method.estimatedDeliveryDays,
        carrier: method.carrier
      });
    }

    res.json({
      success: true,
      shippingMethods: availableMethods
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate order metrics for shipping
 */
async function calculateOrderMetrics(items) {
  let subtotal = 0;
  let totalWeight = 0;
  let totalQuantity = 0;
  let maxDimensions = { length: 0, width: 0, height: 0 };

  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (product) {
      subtotal += product.price * item.quantity;
      totalQuantity += item.quantity;
      
      if (product.weight) {
        totalWeight += product.weight * item.quantity;
      }

      if (product.dimensions) {
        maxDimensions.length = Math.max(maxDimensions.length, product.dimensions.length || 0);
        maxDimensions.width = Math.max(maxDimensions.width, product.dimensions.width || 0);
        maxDimensions.height += (product.dimensions.height || 0) * item.quantity;
      }
    }
  }

  return {
    subtotal,
    totalWeight,
    totalQuantity,
    maxDimensions
  };
}

/**
 * Check if shipping method applies to address
 */
async function methodAppliesToAddress(method, address) {
  for (const zone of method.zones) {
    const matchesCountry = !zone.countries?.length || zone.countries.includes(address.country);
    const matchesState = !zone.states?.length || zone.states.includes(address.state);
    const matchesCity = !zone.cities?.length || zone.cities.includes(address.city);
    
    let matchesPostalCode = true;
    if (zone.postalCodes?.length) {
      matchesPostalCode = zone.postalCodes.some(range => {
        if (range.start && range.end) {
          return address.zipCode >= range.start && address.zipCode <= range.end;
        }
        return address.zipCode === range.start;
      });
    }

    if (matchesCountry && matchesState && matchesCity && matchesPostalCode) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate shipping cost based on method type
 */
function calculateShippingCost(method, metrics) {
  switch (method.pricingType) {
    case 'flat':
      return method.baseCost;

    case 'weight_based':
      for (const rate of method.weightRates) {
        if (metrics.totalWeight >= (rate.minWeight || 0) && 
            metrics.totalWeight <= (rate.maxWeight || Infinity)) {
          return rate.cost;
        }
      }
      return method.baseCost;

    case 'price_based':
      for (const rate of method.priceRates) {
        if (metrics.subtotal >= (rate.minPrice || 0) && 
            metrics.subtotal <= (rate.maxPrice || Infinity)) {
          return rate.cost;
        }
      }
      return method.baseCost;

    case 'quantity_based':
      for (const rate of method.quantityRates) {
        if (metrics.totalQuantity >= (rate.minQuantity || 0) && 
            metrics.totalQuantity <= (rate.maxQuantity || Infinity)) {
          return rate.cost;
        }
      }
      return method.baseCost;

    default:
      return method.baseCost;
  }
}

/**
 * Get all shipping zones (Admin)
 */
export const getShippingZones = async (req, res, next) => {
  try {
    const zones = await ShippingZone.find().sort({ name: 1 });
    res.json({ success: true, zones });
  } catch (error) {
    next(error);
  }
};

/**
 * Create shipping zone (Admin)
 */
export const createShippingZone = async (req, res, next) => {
  try {
    const zone = await ShippingZone.create(req.body);
    res.status(201).json({ success: true, zone });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipping zone (Admin)
 */
export const updateShippingZone = async (req, res, next) => {
  const { id } = req.params;

  try {
    const zone = await ShippingZone.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    res.json({ success: true, zone });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete shipping zone (Admin)
 */
export const deleteShippingZone = async (req, res, next) => {
  const { id } = req.params;

  try {
    const zone = await ShippingZone.findByIdAndDelete(id);
    
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all shipping methods (Admin)
 */
export const getShippingMethods = async (req, res, next) => {
  try {
    const methods = await ShippingMethod.find()
      .populate('zones')
      .sort({ sortOrder: 1 });
    res.json({ success: true, methods });
  } catch (error) {
    next(error);
  }
};

/**
 * Create shipping method (Admin)
 */
export const createShippingMethod = async (req, res, next) => {
  try {
    const method = await ShippingMethod.create(req.body);
    res.status(201).json({ success: true, method });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipping method (Admin)
 */
export const updateShippingMethod = async (req, res, next) => {
  const { id } = req.params;

  try {
    const method = await ShippingMethod.findByIdAndUpdate(id, req.body, { new: true })
      .populate('zones');
    
    if (!method) {
      return res.status(404).json({ success: false, message: 'Method not found' });
    }

    res.json({ success: true, method });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete shipping method (Admin)
 */
export const deleteShippingMethod = async (req, res, next) => {
  const { id } = req.params;

  try {
    const method = await ShippingMethod.findByIdAndDelete(id);
    
    if (!method) {
      return res.status(404).json({ success: false, message: 'Method not found' });
    }

    res.json({ success: true, message: 'Method deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get shipment by order
 */
export const getShipmentByOrder = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const shipment = await Shipment.findOne({ order: orderId })
      .populate('shippingMethod');

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    res.json({ success: true, shipment });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipment status
 */
export const updateShipmentStatus = async (req, res, next) => {
  const { shipmentId } = req.params;
  const { status, trackingNumber, trackingUrl, location, description } = req.body;

  try {
    const shipment = await Shipment.findById(shipmentId);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Update tracking info
    if (trackingNumber) shipment.trackingNumber = trackingNumber;
    if (trackingUrl) shipment.trackingUrl = trackingUrl;

    // Update status
    if (status) {
      shipment.status = status;
      shipment.statusHistory.push({
        status,
        timestamp: new Date(),
        location,
        description
      });
    }

    await shipment.save();

    // Update order status if delivered
    if (status === 'delivered') {
      await Order.findByIdAndUpdate(shipment.order, {
        isDelivered: true,
        deliveredAt: new Date(),
        orderStatus: 'Delivered'
      });
    }

    res.json({ success: true, shipment });
  } catch (error) {
    next(error);
  }
};

export default {
  calculateShipping,
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  getShippingMethods,
  createShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  getShipmentByOrder,
  updateShipmentStatus
};
