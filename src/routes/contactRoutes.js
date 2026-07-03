import express from 'express';
import { submitContactForm, getContactSettings } from '../controllers/contactController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/', optionalAuth, submitContactForm);
router.get('/settings', getContactSettings);

export default router;
