const db = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get notifications with type information
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
      WHERE n.user_id = $1 OR n.user_id IS NULL
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM notifications n
      WHERE n.user_id = $1 OR n.user_id IS NULL
    `, [userId]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
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
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE (n.user_id = $1 OR n.user_id IS NULL)
      AND n.is_read = FALSE
    `, [userId]);

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    await db.query(`
      UPDATE notifications
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
    `, [id, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.session.user.id;

    await db.query(`
      UPDATE notifications
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
    `, [userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
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

    res.json({ settings: settings.rows });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { settings } = req.body;

    // Update each setting
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
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { type_name, user_id, title, message, url, data } = req.body;

    // Get type_id from type_name
    const typeResult = await db.query(`
      SELECT id FROM notification_types WHERE name = $1
    `, [type_name]);

    if (typeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const type_id = typeResult.rows[0].id;

    // Create notification
    await db.query(`
      INSERT INTO notifications (type_id, user_id, title, message, url, data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [type_id, user_id, title, message, url, data ? JSON.stringify(data) : null]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};
