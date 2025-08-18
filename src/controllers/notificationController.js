// src/controllers/notificationController.js - Enhanced version with connect-flash integration
const db = require('../config/db');

// Service functions for creating notifications
const createNotification = async ({ type_name, user_id = null, title, message, url = null, data = null }) => {
  try {
    // Get type_id from type_name
    const typeResult = await db.query('SELECT id FROM notification_types WHERE name = $1', [type_name]);

    if (typeResult.rows.length === 0) {
      console.error(`Notification type '${type_name}' not found`);
      return false;
    }

    const type_id = typeResult.rows[0].id;

    await db.query(
      'INSERT INTO notifications (type_id, user_id, title, message, url, data) VALUES ($1, $2, $3, $4, $5, $6)',
      [type_id, user_id, title, message, url, data ? JSON.stringify(data) : null]
    );

    console.log(`✅ Created notification: ${title} for user ${user_id || 'ALL'}`);
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

// Create notification for all users (broadcast)
const createBroadcastNotification = async ({ type_name, title, message, url = null, data = null, excludeUserId = null }) => {
  try {
    const typeResult = await db.query('SELECT id FROM notification_types WHERE name = $1', [type_name]);

    if (typeResult.rows.length === 0) {
      console.error(`Notification type '${type_name}' not found`);
      return false;
    }

    const type_id = typeResult.rows[0].id;

    // Get all user IDs except the excluded one
    let userQuery = 'SELECT id FROM users WHERE active = true';
    let queryParams = [];

    if (excludeUserId) {
      userQuery += ' AND id != $1';
      queryParams = [excludeUserId];
    }

    const usersResult = await db.query(userQuery, queryParams);

    // Create notifications for all users
    let successCount = 0;
    for (const user of usersResult.rows) {
      try {
        await db.query(
          'INSERT INTO notifications (type_id, user_id, title, message, url, data) VALUES ($1, $2, $3, $4, $5, $6)',
          [type_id, user.id, title, message, url, data ? JSON.stringify(data) : null]
        );
        successCount++;
      } catch (error) {
        console.error(`Failed to create notification for user ${user.id}:`, error);
      }
    }

    console.log(`✅ Created broadcast notification for ${successCount} users`);
    return successCount;
  } catch (error) {
    console.error('Error creating broadcast notification:', error);
    return false;
  }
};

// Main controller functions
exports.getNotifications = async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const notifications = await db.query(`
      SELECT
        n.id,
        n.title,
        n.message,
        n.url,
        n.data,
        n.is_read,
        n.read_at,
        n.created_at,
        nt.name as type_name,
        nt.icon,
        nt.color
      FROM notifications n
      JOIN notification_types nt ON n.type_id = nt.id
      WHERE n.user_id = $1
      ORDER BY n.is_read ASC, n.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      notifications: notifications.rows,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const userId = req.session.user.id;

    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.session.user.id;

    await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
};

exports.getNotificationSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const settings = await db.query(`
      SELECT
        ns.id,
        ns.enabled,
        ns.email_enabled,
        ns.browser_enabled,
        nt.name,
        nt.description,
        nt.icon,
        nt.color
      FROM notification_settings ns
      JOIN notification_types nt ON ns.type_id = nt.id
      WHERE ns.user_id = $1
      ORDER BY nt.name
    `, [userId]);

    res.json({
      success: true,
      settings: settings.rows
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { settings } = req.body;

    for (const setting of settings) {
      await db.query(`
        UPDATE notification_settings
        SET enabled = $1, email_enabled = $2, browser_enabled = $3
        WHERE id = $4 AND user_id = $5
      `, [
        setting.enabled,
        setting.email_enabled,
        setting.browser_enabled,
        setting.id,
        userId
      ]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
};

// Enhanced broadcast notification with flash integration
exports.broadcastNotification = async (req, res) => {
  try {
    const { title, message, url } = req.body;
    const senderId = req.session.user.id;

    if (!title || !title.trim() || !message || !message.trim()) {
      req.flash('error', 'Title and message are required');
      return res.redirect('/notifications/broadcast');
    }

    const userCount = await createBroadcastNotification({
      type_name: 'admin_broadcast',
      title: title.trim(),
      message: message.trim(),
      url: url && url.trim() ? url.trim() : null,
      excludeUserId: senderId
    });

    if (userCount === false) {
      req.flash('error', 'Failed to send notification. Please try again.');
      return res.redirect('/notifications/broadcast');
    }

    req.flash('success', `Notification sent to ${userCount} users successfully!`);
    res.redirect('/notifications/broadcast');
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    req.flash('error', 'Failed to broadcast notification. Please try again.');
    res.redirect('/notifications/broadcast');
  }
};

// History page with flash messages
exports.getNotificationHistory = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const result = await db.query(`
      SELECT n.*, nt.icon, nt.color
      FROM notifications n
      JOIN notification_types nt ON n.type_id = nt.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 100
    `, [userId]);

    res.render('layout', {
      title: 'Notifications History',
      body: 'notifications/history',
      notifications: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading notifications history:', error);
    req.flash('error', 'Failed to load notifications history');
    res.render('layout', {
      title: 'Notifications History',
      body: 'notifications/history',
      notifications: [],
      user: req.session.user
    });
  }
};

// Warranty notification functions
const checkWarrantyExpiration = async () => {
  try {
    console.log('🔍 Starting warranty expiration check...');

    // Items expiring in 30 days
    const expiringResult = await db.query(`
      SELECT
        i.id,
        i.name,
        i.cep_brc,
        i.warranty_end_date,
        EXTRACT(DAY FROM (i.warranty_end_date - CURRENT_DATE)) as days_until_expiry,
        e.id as employee_id,
        e.name as employee_name,
        u.id as user_id,
        u.name as user_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE i.warranty_end_date IS NOT NULL
      AND i.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        JOIN notification_types nt ON n.type_id = nt.id
        WHERE nt.name = 'warranty_expiring'
        AND n.data->>'item_id' = i.id::text
        AND n.created_at > CURRENT_DATE - INTERVAL '7 days'
      )
    `);

    const expiredResult = await db.query(`
      SELECT
        i.id,
        i.name,
        i.cep_brc,
        i.warranty_end_date,
        EXTRACT(DAY FROM (CURRENT_DATE - i.warranty_end_date)) as days_expired,
        e.id as employee_id,
        e.name as employee_name,
        u.id as user_id,
        u.name as user_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE i.warranty_end_date IS NOT NULL
      AND i.warranty_end_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        JOIN notification_types nt ON n.type_id = nt.id
        WHERE nt.name = 'warranty_expired'
        AND n.data->>'item_id' = i.id::text
        AND n.created_at > CURRENT_DATE - INTERVAL '30 days'
      )
    `);

    // Create notifications for expiring warranties
    for (const item of expiringResult.rows) {
      const daysUntilExpiry = Math.ceil(parseFloat(item.days_until_expiry));

      if (item.user_id) {
        // Notify assigned user
        await createNotification({
          type_name: 'warranty_expiring',
          user_id: item.user_id,
          title: 'Warranty Expiring Soon',
          message: `Warranty for "${item.name}" (${item.cep_brc}) expires in ${daysUntilExpiry} days`,
          url: `/items/${item.id}/${item.cep_brc}`,
          data: { item_id: item.id, days_until_expiry: daysUntilExpiry }
        });
      }

      // Notify all admins
      const adminResult = await db.query(`
        SELECT DISTINCT u.id FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('admin', 'super_admin')
      `);

      for (const admin of adminResult.rows) {
        await createNotification({
          type_name: 'warranty_expiring',
          user_id: admin.id,
          title: 'Asset Warranty Expiring',
          message: `Warranty for "${item.name}" (${item.cep_brc}) expires in ${daysUntilExpiry} days${item.employee_name ? ` - Assigned to ${item.employee_name}` : ' - Unassigned'}`,
          url: `/items/${item.id}/${item.cep_brc}`,
          data: { item_id: item.id, days_until_expiry: daysUntilExpiry }
        });
      }
    }

    // Create notifications for expired warranties
    for (const item of expiredResult.rows) {
      const daysExpired = Math.ceil(parseFloat(item.days_expired));

      if (item.user_id) {
        // Notify assigned user
        await createNotification({
          type_name: 'warranty_expired',
          user_id: item.user_id,
          title: 'Warranty Has Expired',
          message: `Warranty for "${item.name}" (${item.cep_brc}) expired ${daysExpired} days ago`,
          url: `/items/${item.id}/${item.cep_brc}`,
          data: { item_id: item.id, days_expired: daysExpired }
        });
      }

      // Notify all admins
      const adminResult = await db.query(`
        SELECT DISTINCT u.id FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('admin', 'super_admin')
      `);

      for (const admin of adminResult.rows) {
        await createNotification({
          type_name: 'warranty_expired',
          user_id: admin.id,
          title: 'Asset Warranty Expired',
          message: `Warranty for "${item.name}" (${item.cep_brc}) expired ${daysExpired} days ago${item.employee_name ? ` - Assigned to ${item.employee_name}` : ' - Unassigned'}`,
          url: `/items/${item.id}/${item.cep_brc}`,
          data: { item_id: item.id, days_expired: daysExpired }
        });
      }
    }

    console.log(`✅ Warranty check completed: ${expiringResult.rows.length} expiring, ${expiredResult.rows.length} expired`);
    return {
      expiring: expiringResult.rows.length,
      expired: expiredResult.rows.length
    };
  } catch (error) {
    console.error('❌ Error checking warranty expiration:', error);
    return null;
  }
};

// Helper function to create item assignment notifications
const createItemAssignmentNotification = async (itemId, employeeId, action = 'assigned') => {
  try {
    // Get item and employee details
    const itemResult = await db.query(`
      SELECT i.*, e.name as employee_name, u.id as user_id
      FROM items i
      LEFT JOIN employees e ON $2 = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE i.id = $1
    `, [itemId, employeeId]);

    if (itemResult.rows.length === 0) {
      console.error('Item not found for assignment notification');
      return false;
    }

    const item = itemResult.rows[0];
    const type_name = action === 'assigned' ? 'item_assignment' : 'item_unassignment';
    const title = action === 'assigned' ? 'Item Assigned' : 'Item Unassigned';
    const message = action === 'assigned'
      ? `"${item.name}" (${item.cep_brc}) has been assigned to you`
      : `"${item.name}" (${item.cep_brc}) has been unassigned from you`;

    if (item.user_id) {
      await createNotification({
        type_name,
        user_id: item.user_id,
        title,
        message,
        url: `/items/${item.id}/${item.cep_brc}`,
        data: { item_id: itemId, employee_id: employeeId, action }
      });
    }

    return true;
  } catch (error) {
    console.error('Error creating item assignment notification:', error);
    return false;
  }
};

// Initialize notification system - creates required tables if they don't exist
const initializeNotificationSystem = async () => {
  try {
    console.log('🔧 Initializing notification system...');

    // Create notification_types table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT 'fas fa-bell',
        color VARCHAR(20) DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type_id INTEGER REFERENCES notification_types(id),
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        url VARCHAR(500),
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notification_settings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type_id INTEGER REFERENCES notification_types(id),
        enabled BOOLEAN DEFAULT TRUE,
        email_enabled BOOLEAN DEFAULT FALSE,
        browser_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, type_id)
      )
    `);

    // Insert default notification types
    const defaultTypes = [
      { name: 'admin_broadcast', description: 'Admin broadcast messages', icon: 'fas fa-bullhorn', color: 'red' },
      { name: 'warranty_expiring', description: 'Warranty expiring soon', icon: 'fas fa-exclamation-triangle', color: 'yellow' },
      { name: 'warranty_expired', description: 'Warranty has expired', icon: 'fas fa-times-circle', color: 'red' },
      { name: 'item_assignment', description: 'Item assigned to you', icon: 'fas fa-hand-holding', color: 'green' },
      { name: 'item_unassignment', description: 'Item unassigned from you', icon: 'fas fa-hand', color: 'orange' },
      { name: 'system_update', description: 'System updates and maintenance', icon: 'fas fa-cog', color: 'blue' },
      { name: 'security_alert', description: 'Security alerts', icon: 'fas fa-shield-alt', color: 'red' }
    ];

    for (const type of defaultTypes) {
      await db.query(`
        INSERT INTO notification_types (name, description, icon, color)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color
      `, [type.name, type.description, type.icon, type.color]);
    }

    // Create indexes for better performance
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_type_id ON notifications(type_id)');

    console.log('✅ Notification system initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing notification system:', error);
    return false;
  }
};

// Export notification helper functions
exports.createNotification = createNotification;
exports.createBroadcastNotification = createBroadcastNotification;
exports.checkWarrantyExpiration = checkWarrantyExpiration;
exports.createItemAssignmentNotification = createItemAssignmentNotification;
exports.initializeNotificationSystem = initializeNotificationSystem;
exports.markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    await db.query(
      'UPDATE notifications SET is_read = FALSE, read_at = NULL WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark as unread' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await db.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete all notifications' });
  }
};
