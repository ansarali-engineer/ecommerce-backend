import express from 'express';
import {
  createReturnRequest,
  getUserReturns,
  getReturnById,
  getAllReturns,
  approveReturn,
  rejectReturn,
  receiveReturn,
  processReturnRefund
} from '../controllers/returnController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// User routes
router.use(protect);

router.post('/', createReturnRequest);
router.get('/my-returns', getUserReturns);
router.get('/:id', getReturnById);

// Admin routes
router.use(admin);

router.get('/admin/all', getAllReturns);
router.put('/:id/approve', approveReturn);
router.put('/:id/reject', rejectReturn);
router.put('/:id/receive', receiveReturn);
router.put('/:id/refund', processReturnRefund);

export default router;
