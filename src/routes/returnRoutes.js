import express from 'express';
import {
  getRefundEligibility,
  createReturnRequest,
  getUserReturns,
  getReturnById,
  cancelReturnRequest,
  getAllReturns,
  approveReturn,
  rejectReturn,
  requestReturnInfo,
  receiveReturn,
  processReturnRefund,
  markUnderReview
} from '../controllers/returnController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import {
  returnRequestSchema,
  returnActionSchema,
  processRefundSchema,
  returnInfoRequestSchema
} from '../validation/schemas.js';

const router = express.Router();

router.use(protect);

router.get('/eligibility/:orderId', getRefundEligibility);
router.post('/', validateBody(returnRequestSchema), createReturnRequest);
router.get('/my-returns', getUserReturns);

router.get('/admin/all', admin, getAllReturns);
router.put('/:id/under-review', admin, validateBody(returnActionSchema), markUnderReview);
router.put('/:id/approve', admin, validateBody(returnActionSchema), approveReturn);
router.put('/:id/reject', admin, validateBody(returnActionSchema), rejectReturn);
router.put('/:id/request-info', admin, validateBody(returnInfoRequestSchema), requestReturnInfo);
router.put('/:id/receive', admin, receiveReturn);
router.put('/:id/refund', admin, validateBody(processRefundSchema), processReturnRefund);

router.put('/:id/cancel', cancelReturnRequest);
router.get('/:id', getReturnById);

export default router;
