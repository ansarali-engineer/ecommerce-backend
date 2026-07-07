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

router.use(protect);

// User routes
router.post('/', createReturnRequest);
router.get('/my-returns', getUserReturns);

// Admin routes — static paths before /:id
router.get('/admin/all', admin, getAllReturns);
router.put('/:id/approve', admin, approveReturn);
router.put('/:id/reject', admin, rejectReturn);
router.put('/:id/receive', admin, receiveReturn);
router.put('/:id/refund', admin, processReturnRefund);

// User route — parameterized path last
router.get('/:id', getReturnById);

export default router;
