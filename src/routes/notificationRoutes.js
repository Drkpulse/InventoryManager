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
    user: req.session.user,
    messages: {
      success: req.flash('success'),
      error: req.flash('error'),
      info: req.flash('info')
    }
  });
});

router.post('/broadcast', isAdmin, broadcastNotification);

// Admin route to manually trigger warranty check
router.post('/check-warranties', isAdmin, async (req, res) => {
  try {
    const result = await checkWarrantyExpiration();
    if (result) {
      req.flash('success', `Warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
      res.json({
        success: true,
        message: `Warranty check completed: ${result.expiring} expiring, ${result.expired} expired`,
        result
      });
    } else {
      req.flash('error', 'Failed to check warranties');
      res.status(500).json({
        success: false,
        error: 'Failed to check warranties'
      });
    }
  } catch (error) {
    console.error('Error in warranty check endpoint:', error);
    req.flash('error', 'Failed to check warranties');
    res.status(500).json({
      success: false,
      error: 'Failed to check warranties'
    });
  }
});

// Admin route to view notification management
router.get('/manage', isAdmin, async (req, res) => {
  try {
    const db = require('../config/db');

    // Get notification statistics
    const statsResult = await db.query(`
      SELECT
        nt.name,
        nt.description,
        nt.icon,
        nt.color,
        COUNT(n.id) as total_notifications,
        COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_count,
        COUNT(CASE WHEN n.created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_count
      FROM notification_types nt
      LEFT JOIN notifications n ON nt.id = n.type_id
      GROUP BY nt.id, nt.name, nt.description, nt.icon, nt.color
      ORDER BY nt.name
    `);

    // Get recent notifications
    const recentResult = await db.query(`
      SELECT
        n.*,
        nt.name as type_name,
        nt.icon,
        nt.color,
        u.username,
        u.name as user_name
      FROM notifications n
      JOIN notification_types nt ON n.type_id = nt.id
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
      LIMIT 20
    `);

    res.render('layout', {
      title: 'Notification Management',
      body: 'notifications/manage',
      user: req.session.user,
      stats: statsResult.rows,
      recentNotifications: recentResult.rows,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
      }
    });
  } catch (error) {
    console.error('Error loading notification management:', error);
    req.flash('error', 'Failed to load notification management');
    res.redirect('/admin');
  }
});

// Test notification endpoint for debugging
router.post('/test', isAdmin, async (req, res) => {
  try {
    const { createNotification } = require('../controllers/notificationController');

    const result = await createNotification({
      type_name: 'system_update',
      user_id: req.session.user.id,
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working correctly.',
      url: '/notifications/history'
    });

    if (result) {
      req.flash('success', 'Test notification created successfully!');
      res.json({ success: true, message: 'Test notification created' });
    } else {
      req.flash('error', 'Failed to create test notification');
      res.status(500).json({ success: false, error: 'Failed to create test notification' });
    }
  } catch (error) {
    console.error('Error creating test notification:', error);
    req.flash('error', 'Failed to create test notification');
    res.status(500).json({ success: false, error: 'Failed to create test notification' });
  }
});

module.exports = router;
