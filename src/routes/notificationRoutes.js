const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  broadcastNotification,
  getNotificationHistory,
  checkWarrantyExpiration
} = require('../controllers/notificationController');

// Get user notifications (API endpoint)
router.get('/', isAuthenticated, getNotifications);

// Get unread notification count
router.get('/unread-count', isAuthenticated, getUnreadCount);

// Mark notification as read
router.put('/:id/read', isAuthenticated, markAsRead);

// Mark all notifications as read
router.put('/mark-all-read', isAuthenticated, markAllAsRead);

// Get notification settings
router.get('/settings', isAuthenticated, getNotificationSettings);

// Update notification settings
router.put('/settings', isAuthenticated, updateNotificationSettings);

// Notification history page
router.get('/history', isAuthenticated, getNotificationHistory);

// Admin routes
router.get('/broadcast', isAdmin, (req, res) => {
  res.render('layout', {
    title: 'Send Notification',
    body: 'notifications/broadcast',
    user: req.session.user
  });
});

router.post('/broadcast', isAdmin, broadcastNotification);

// Admin route to manually trigger warranty check
router.post('/check-warranties', isAdmin, async (req, res) => {
  try {
    const result = await checkWarrantyExpiration();
    if (result) {
      res.json({
        success: true,
        message: `Warranty check completed: ${result.expiring} expiring, ${result.expired} expired`,
        result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to check warranties'
      });
    }
  } catch (error) {
    console.error('Error in warranty check endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check warranties'
    });
  }
});

module.exports = router;
