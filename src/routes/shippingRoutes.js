import express from 'express';
import {
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
} from '../controllers/shippingController.js';
import { protect, admin, hasPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for calculating shipping
router.post('/calculate', calculateShipping);

// Protected routes
router.use(protect);

// Shipment tracking
router.get('/shipment/:orderId', getShipmentByOrder);

// Admin routes
router.use(admin);

// Shipping zones
router.route('/zones')
  .get(getShippingZones)
  .post(createShippingZone);

router.route('/zones/:id')
  .put(updateShippingZone)
  .delete(deleteShippingZone);

// Shipping methods
router.route('/methods')
  .get(getShippingMethods)
  .post(createShippingMethod);

router.route('/methods/:id')
  .put(updateShippingMethod)
  .delete(deleteShippingMethod);

// Shipment management
router.put('/shipment/:shipmentId/status', updateShipmentStatus);

export default router;
