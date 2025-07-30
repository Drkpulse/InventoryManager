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
    let userQuery = 'SELECT id FROM users';
    let queryParams = [];

    if (excludeUserId) {
      userQuery += ' WHERE id != $1';
      queryParams = [excludeUserId];
    }

    const usersResult = await db.query(userQuery, queryParams);

    // Create notifications for all users
    for (const user of usersResult.rows) {
      await db.query(
        'INSERT INTO notifications (type_id, user_id, title, message, url, data) VALUES ($1, $2, $3, $4, $5, $6)',
        [type_id, user.id, title, message, url, data ? JSON.stringify(data) : null]
      );
    }

    return usersResult.rows.length;
  } catch (error) {
    console.error('Error creating broadcast notification:', error);
    return false;
  }
};

// Main controller functions
exports.getNotifications = async (req, res) => {
  try {
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

// Broadcast notification
exports.broadcastNotification = async (req, res) => {
  try {
    const { title, message, url } = req.body;
    const senderId = req.session.user.id;

    if (!title || !title.trim() || !message || !message.trim()) {
      return res.render('layout', {
        title: 'Send Notification',
        body: 'notifications/broadcast',
        user: req.session.user,
        error: 'Title and message are required'
      });
    }

    const userCount = await createBroadcastNotification({
      type_name: 'admin_broadcast',
      title: title.trim(),
      message: message.trim(),
      url: url && url.trim() ? url.trim() : null,
      excludeUserId: senderId
    });

    if (userCount === false) {
      return res.render('layout', {
        title: 'Send Notification',
        body: 'notifications/broadcast',
        user: req.session.user,
        error: 'Failed to send notification. Please try again.'
      });
    }

    res.render('layout', {
      title: 'Send Notification',
      body: 'notifications/broadcast',
      user: req.session.user,
      success: `Notification sent to ${userCount} users successfully!`
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.render('layout', {
      title: 'Send Notification',
      body: 'notifications/broadcast',
      user: req.session.user,
      error: 'Failed to broadcast notification. Please try again.'
    });
  }
};

// History page
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
    res.status(500).render('layout', {
      title: 'Notifications History',
      body: 'notifications/history',
      notifications: [],
      user: req.session.user,
      error: 'Failed to load notifications history'
    });
  }
};

// Warranty notification functions
const checkWarrantyExpiration = async () => {
  try {
    // Items expiring in 30 days
    const expiringResult = await db.query(`
      SELECT i.*, u.id as user_id, u.name as user_name, e.name as employee_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
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

    // Items already expired
    const expiredResult = await db.query(`
      SELECT i.*, u.id as user_id, u.name as user_name, e.name as employee_name
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
      const daysUntilExpiry = Math.ceil((new Date(item.warranty_end_date) - new Date()) / (1000 * 60 * 60 * 24));

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
      const daysExpired = Math.ceil((new Date() - new Date(item.warranty_end_date)) / (1000 * 60 * 60 * 24));

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

    console.log(`Warranty check completed: ${expiringResult.rows.length} expiring, ${expiredResult.rows.length} expired`);
    return {
      expiring: expiringResult.rows.length,
      expired: expiredResult.rows.length
    };
  } catch (error) {
    console.error('Error checking warranty expiration:', error);
    return null;
  }
};

// Export notification helper functions
exports.createNotification = createNotification;
exports.createBroadcastNotification = createBroadcastNotification;
exports.checkWarrantyExpiration = checkWarrantyExpiration;
