// src/middleware/notificationMiddleware.js - Integration with connect-flash
const { createNotification, createBroadcastNotification } = require('../controllers/notificationController');

// Middleware to add notification helpers to req object
const addNotificationHelpers = (req, res, next) => {
  // Helper to create a notification and optionally show flash message
  req.createNotification = async ({ type_name, user_id = null, title, message, url = null, data = null, flashMessage = null }) => {
    try {
      const result = await createNotification({ type_name, user_id, title, message, url, data });

      if (result && flashMessage) {
        req.flash('info', flashMessage);
      }

      return result;
    } catch (error) {
      console.error('Error in notification helper:', error);
      return false;
    }
  };

  // Helper to create broadcast notification
  req.createBroadcastNotification = async ({ type_name, title, message, url = null, data = null, excludeUserId = null, flashMessage = null }) => {
    try {
      const result = await createBroadcastNotification({ type_name, title, message, url, data, excludeUserId });

      if (result && flashMessage) {
        req.flash('success', flashMessage);
      }

      return result;
    } catch (error) {
      console.error('Error in broadcast notification helper:', error);
      return false;
    }
  };

  // Helper to create assignment notifications with flash
  req.notifyItemAssignment = async (itemId, employeeId, action = 'assigned') => {
    try {
      const { createItemAssignmentNotification } = require('../controllers/notificationController');
      const result = await createItemAssignmentNotification(itemId, employeeId, action);

      if (result) {
        const actionText = action === 'assigned' ? 'assigned' : 'unassigned';
        req.flash('success', `Item ${actionText} successfully and notification sent to employee.`);
      }

      return result;
    } catch (error) {
      console.error('Error in item assignment notification:', error);
      return false;
    }
  };

  next();
};

// Middleware to add unread notification count to all views
const addNotificationCount = async (req, res, next) => {
  try {
    // Only add count if user is authenticated
    if (req.session?.user?.id) {
      const db = require('../config/db');
      const result = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [req.session.user.id]
      );

      res.locals.unreadNotificationCount = parseInt(result.rows[0].count) || 0;
    } else {
      res.locals.unreadNotificationCount = 0;
    }
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.locals.unreadNotificationCount = 0;
  }

  next();
};

// Middleware to ensure notification system is initialized for new users
const ensureUserNotificationSettings = async (req, res, next) => {
  try {
    if (req.session?.user?.id) {
      const db = require('../config/db');

      // Check if user has notification settings
      const settingsResult = await db.query(
        'SELECT COUNT(*) as count FROM notification_settings WHERE user_id = $1',
        [req.session.user.id]
      );

      // If no settings exist, create default ones
      if (parseInt(settingsResult.rows[0].count) === 0) {
        await db.query(`
          INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
          SELECT $1, nt.id, true, false, true
          FROM notification_types nt
        `, [req.session.user.id]);

        console.log(`✅ Created default notification settings for user ${req.session.user.id}`);
      }
    }
  } catch (error) {
    console.error('Error ensuring user notification settings:', error);
  }

  next();
};

// Flash message types mapper for notifications
const flashToNotificationType = {
  'success': 'system_update',
  'error': 'security_alert',
  'info': 'system_update',
  'warning': 'warranty_expiring'
};

// Convert flash messages to persistent notifications for important messages
const convertFlashToNotifications = async (req, res, next) => {
  // Only convert for specific flash types that should be persistent
  const persistentTypes = ['security_alert', 'warranty_expiring', 'warranty_expired'];

  try {
    if (req.session?.user?.id) {
      const messages = req.session.flash || {};

      for (const [type, messageArray] of Object.entries(messages)) {
        if (messageArray && messageArray.length > 0) {
          const notificationType = flashToNotificationType[type];

          if (notificationType && persistentTypes.includes(notificationType)) {
            for (const message of messageArray) {
              await createNotification({
                type_name: notificationType,
                user_id: req.session.user.id,
                title: type.charAt(0).toUpperCase() + type.slice(1),
                message: message,
                data: { source: 'flash_message', type: type }
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error converting flash to notifications:', error);
  }

  next();
};

module.exports = {
  addNotificationHelpers,
  addNotificationCount,
  ensureUserNotificationSettings,
  convertFlashToNotifications
};
