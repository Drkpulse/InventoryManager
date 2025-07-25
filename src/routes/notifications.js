const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { isAuthenticated } = require('../middleware/auth');

// Get user notifications
router.get('/', isAuthenticated, notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', isAuthenticated, notificationController.getUnreadCount);

// Mark notification as read
router.post('/:id/read', isAuthenticated, notificationController.markAsRead);

// Mark all notifications as read
router.post('/mark-all-read', isAuthenticated, notificationController.markAllAsRead);

// Get notification settings
router.get('/settings', isAuthenticated, notificationController.getNotificationSettings);

// Update notification settings
router.post('/settings', isAuthenticated, notificationController.updateNotificationSettings);

// Create notification (admin/system use)
router.post('/create', isAuthenticated, notificationController.createNotification);

module.exports = router;
