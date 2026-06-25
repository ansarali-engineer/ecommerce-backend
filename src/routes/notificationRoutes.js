import express from 'express';
import notificationService from '../services/NotificationService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes protected
router.use(protect);

// Get user notifications
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true'
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUserNotifications(req.user._id, {
      page: 1,
      limit: 0,
      unreadOnly: true
    });
    res.json({ success: true, unreadCount: count.unreadCount });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id, 
      req.user._id
    );
    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

// Mark all as read
router.put('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete('/:id', async (req, res, next) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user._id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
