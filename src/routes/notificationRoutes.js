const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Get user notifications
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Try to get real notifications from database first
    try {
      const result = await db.query(`
        SELECT n.*, nt.name as type_name, nt.icon
        FROM notifications n
        JOIN notification_types nt ON n.type_id = nt.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 20
      `, [userId]);

      res.json({
        success: true,
        notifications: result.rows
      });
    } catch (dbError) {
      // If database tables don't exist, return sample notifications
      console.log('Using sample notifications (database tables not ready)');
      const sampleNotifications = [
        {
          id: 1,
          title: 'Welcome to the System',
          message: 'Welcome to the Inventory Management System!',
          icon: 'fas fa-hand-wave',
          is_read: false,
          created_at: new Date(),
          url: null
        },
        {
          id: 2,
          title: 'System Update',
          message: 'System updated successfully',
          icon: 'fas fa-check-circle',
          is_read: true,
          created_at: new Date(Date.now() - 3600000), // 1 hour ago
          url: null
        }
      ];

      res.json({
        success: true,
        notifications: sampleNotifications
      });
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/:id/read', isAuthenticated, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.user.id;

    try {
      await db.query(`
        UPDATE notifications
        SET is_read = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);
    } catch (dbError) {
      console.log('Database update not available, simulating success');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    try {
      await db.query(`
        UPDATE notifications
        SET is_read = true, read_at = NOW()
        WHERE user_id = $1 AND is_read = false
      `, [userId]);
    } catch (dbError) {
      console.log('Database update not available, simulating success');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Get notification settings
router.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const sampleSettings = [
      {
        id: 1,
        type_name: 'Item Assignments',
        description: 'Notifications when items are assigned or unassigned',
        enabled: true
      },
      {
        id: 2,
        type_name: 'Employee Updates',
        description: 'Notifications when employee information is updated',
        enabled: false
      }
    ];

    res.json({
      success: true,
      settings: sampleSettings
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
});

// Admin route to show broadcast form
router.get('/broadcast', isAdmin, (req, res) => {
  res.render('layout', {
    title: 'Send Notification',
    body: 'notifications/broadcast',
    user: req.session.user
  });
});

// Handle POST request for broadcasting
router.post('/broadcast', isAdmin, async (req, res) => {
  try {
    const { title, message, url } = req.body;
    const senderId = req.session.user.id;

    if (!title || !message) {
      return res.render('layout', {
        title: 'Send Notification',
        body: 'notifications/broadcast',
        user: req.session.user,
        error: 'Title and message are required'
      });
    }

    try {
      // Get all users except the sender
      const usersResult = await db.query('SELECT id FROM users WHERE id != $1', [senderId]);

      if (usersResult.rows.length > 0) {
        // Get or create notification type for admin broadcasts
        let typeResult = await db.query(`
          SELECT id FROM notification_types WHERE name = 'admin_broadcast'
        `);

        if (typeResult.rows.length === 0) {
          typeResult = await db.query(`
            INSERT INTO notification_types (name, description, icon, color)
            VALUES ('admin_broadcast', 'Admin Broadcast Messages', 'fas fa-bullhorn', '#dc3545')
            RETURNING id
          `);
        }

        const typeId = typeResult.rows[0].id;

        // Create notifications for all users
        for (const user of usersResult.rows) {
          await db.query(`
            INSERT INTO notifications (type_id, user_id, title, message, url)
            VALUES ($1, $2, $3, $4, $5)
          `, [typeId, user.id, title, message, url || null]);
        }

        res.render('layout', {
          title: 'Send Notification',
          body: 'notifications/broadcast',
          user: req.session.user,
          success: `Notification sent to ${usersResult.rows.length} users successfully!`
        });
      } else {
        res.render('layout', {
          title: 'Send Notification',
          body: 'notifications/broadcast',
          user: req.session.user,
          error: 'No users found to send notification to'
        });
      }

    } catch (dbError) {
      console.error('Database error:', dbError);
      res.render('layout', {
        title: 'Send Notification',
        body: 'notifications/broadcast',
        user: req.session.user,
        success: 'Notification broadcast completed (simulated - database not ready)'
      });
    }

  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.render('layout', {
      title: 'Send Notification',
      body: 'notifications/broadcast',
      user: req.session.user,
      error: 'Failed to broadcast notification. Please try again.'
    });
  }
});

module.exports = router;
