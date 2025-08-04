/**
 * User Settings Controller
 * Handles user preferences and settings
 */

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { supportedLanguages } = require('../utils/translations');

/**
 * Display user settings page
 */
exports.showSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/');
    }

    const user = userResult.rows[0];
    if (!user.settings) {
      user.settings = {
        theme: 'light',
        language: 'en'
      };
    }

    const showUpdated = req.query.updated === 'true';

    res.render('layout', {
      title: 'User Settings',
      body: 'users/settings',
      user,
      supportedLanguages,
      showUpdated,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    req.flash('error', 'Failed to load settings');
    res.redirect('/');
  }
};

/**
 * Update display settings
 */
exports.updateDisplaySettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { theme, language, timezone, items_per_page } = req.body;

    await ensureSettingsColumnExists();

    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/users/settings');
    }

    let settings = userResult.rows[0].settings || {};
    settings = {
      ...settings,
      theme: theme || 'light',
      language: language || 'en',
      timezone: timezone || 'UTC',
      items_per_page: items_per_page || '20'
    };

    await db.query('UPDATE users SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(settings), userId]);
    req.session.user = { ...req.session.user, settings };
    req.flash('success', 'Display settings updated successfully');
    res.cookie('user_theme', settings.theme || 'light', { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating display settings:', error);
    req.flash('error', 'Failed to update display settings');
    res.redirect('/users/settings');
  }
};

/**
 * Update notification settings
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { email_notifications, browser_notifications, maintenance_alerts, assignment_notifications } = req.body;

    await ensureSettingsColumnExists();

    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/users/settings');
    }

    let settings = userResult.rows[0].settings || {};
    settings = {
      ...settings,
      email_notifications: email_notifications === 'on',
      browser_notifications: browser_notifications === 'on',
      maintenance_alerts: maintenance_alerts === 'on',
      assignment_notifications: assignment_notifications === 'on'
    };

    await db.query('UPDATE users SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(settings), userId]);
    req.session.user = { ...req.session.user, settings };
    req.flash('success', 'Notification settings updated successfully');
    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating notification settings:', error);
    req.flash('error', 'Failed to update notification settings');
    res.redirect('/users/settings');
  }
};

/**
 * Update security settings (password change)
 */
exports.updateSecuritySettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.render('layout', {
        title: 'User Settings',
        body: 'users/settings',
        user: req.session.user,
        error: 'All password fields are required'
      });
    }

    if (new_password !== confirm_password) {
      return res.render('layout', {
        title: 'User Settings',
        body: 'users/settings',
        user: req.session.user,
        error: 'New passwords do not match'
      });
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/users/settings');
    }

    const user = userResult.rows[0];
    const isPasswordValid = await verifyPassword(current_password, user.password);

    if (!isPasswordValid) {
      return res.render('layout', {
        title: 'User Settings',
        body: 'users/settings',
        user: req.session.user,
        error: 'Current password is incorrect'
      });
    }

    const hashedPassword = await hashPassword(new_password);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    req.flash('success', 'Password updated successfully');
    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating security settings:', error);
    req.flash('error', 'Failed to update security settings');
    res.redirect('/users/settings');
  }
};

/**
 * Get user settings as JSON (for API)
 */
exports.getUserSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      settings: userResult.rows[0].settings || {}
    });
  } catch (error) {
    console.error('Error getting user settings:', error);
    res.status(500).json({ error: 'Failed to get user settings' });
  }
};

// Helper function to ensure settings column exists
async function ensureSettingsColumnExists() {
  try {
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'users'
          AND column_name = 'settings'
        ) THEN
          ALTER TABLE users ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.error('Error checking or adding settings column:', error);
    throw error;
  }
}

// Helper functions for password verification and hashing
async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
