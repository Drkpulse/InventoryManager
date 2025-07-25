const db = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    // Get user data with settings
    const userId = req.session.user.id;
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    const user = userResult.rows[0];

    // Check if settings is defined, if not initialize it
    if (!user.settings) {
      user.settings = {
        theme: 'light',
        language: 'en'
      };
    }

    // Pass the showUpdated flag based on query param
    const showUpdated = req.query.updated === 'true';

    res.render('layout', {
      title: 'User Settings',
      body: 'users/settings',
      user: user,
      showUpdated: showUpdated
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).send('Server error');
  }
};

exports.updateDisplaySettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log('🎨 Raw request data:', {
      body: req.body,
      headers: req.headers,
      contentType: req.headers['content-type'],
      isAjax: req.headers['x-requested-with'] === 'XMLHttpRequest'
    });

    const { theme, language, timezone, items_per_page } = req.body;

    console.log('🎨 Updating display settings:', {
      userId,
      theme,
      language,
      timezone,
      items_per_page,
      bodyKeys: Object.keys(req.body)
    });

    // Make sure settings column exists
    await ensureSettingsColumnExists();

    // Get current settings
    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', userId);
      return res.status(404).send('User not found');
    }

    console.log('📊 Current user settings:', userResult.rows[0].settings);

    // Update settings
    let settings = userResult.rows[0].settings || {};

    settings = {
      ...settings,
      theme: theme || 'light',
      language: language || 'en',
      timezone: timezone || 'UTC',
      items_per_page: items_per_page || '20'
    };

    console.log('💾 New settings to save:', settings);

    // Save to database
    await db.query('UPDATE users SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(settings), userId]);

    // Update session
    req.session.user = {
      ...req.session.user,
      settings
    };

    console.log('✅ Settings saved successfully');

    req.flash('success', 'Display settings updated successfully');
    
    // Set cookie for immediate theme application
    res.cookie('user_theme', settings.theme || 'light', {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false // Allow JavaScript access
    });
    
    // Check if this is an AJAX request
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
      res.json({ 
        success: true, 
        message: 'Display settings updated successfully',
        settings: settings,
        theme: settings.theme
      });
    } else {
      res.redirect('/users/settings?updated=true');
    }
  } catch (error) {
    console.error('❌ Error updating display settings:', error);
    
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update settings: ' + error.message 
      });
    } else {
      res.status(500).send('Server error: ' + error.message);
    }
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      email_notifications, 
      browser_notifications, 
      maintenance_alerts, 
      assignment_notifications 
    } = req.body;

    // Make sure settings column exists
    await ensureSettingsColumnExists();

    // Get current settings
    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    // Update settings
    let settings = userResult.rows[0].settings || {};

    settings = {
      ...settings,
      email_notifications: email_notifications === 'on',
      browser_notifications: browser_notifications === 'on',
      maintenance_alerts: maintenance_alerts === 'on',
      assignment_notifications: assignment_notifications === 'on'
    };

    // Save to database
    await db.query('UPDATE users SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(settings), userId]);

    // Update session
    req.session.user = {
      ...req.session.user,
      settings
    };

    req.flash('success', 'Notification settings updated successfully');
    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};

exports.updateSecuritySettings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    // Validate input
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

    // Get user from database to check password
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    const user = userResult.rows[0];

    // Check current password (implement your password verification)
    const isPasswordValid = await verifyPassword(current_password, user.password);

    if (!isPasswordValid) {
      return res.render('layout', {
        title: 'User Settings',
        body: 'users/settings',
        user: req.session.user,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password (implement your password hashing)
    const hashedPassword = await hashPassword(new_password);

    // Update password
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).send('Server error');
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
// Note: Implement these using bcrypt or another secure method
async function verifyPassword(plainPassword, hashedPassword) {
  // Implement your password verification logic
  // This is a placeholder
  const bcrypt = require('bcrypt');
  return await bcrypt.compare(plainPassword, hashedPassword);
}

async function hashPassword(password) {
  // Implement your password hashing logic
  // This is a placeholder
  const bcrypt = require('bcrypt');
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
