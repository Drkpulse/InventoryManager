const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { isAuthenticated, isAdmin } = require('../middleware/auth'); // Import auth middleware
const userController = require('../controllers/userController'); // Import the controller

// Get all users (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role FROM users ORDER BY name');
    res.render('layout', {
      title: 'Users',
      body: 'users/index',
      users: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Server error');
  }
});

// User profile page
router.get('/profile', isAuthenticated, async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  try {
    const userId = req.session.user.id;
    const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);

    res.render('layout', {
      title: 'My Profile',
      body: 'users/profile',
      profile: result.rows[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).send('Server error');
  }
});

// Update user profile
router.post('/profile', isAuthenticated, async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  try {
    const userId = req.session.user.id;
    const { name, email } = req.body;

    await db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, userId]);

    // Update session with new info
    req.session.user.name = name;
    req.session.user.email = email;

    res.redirect('/users/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Server error');
  }
});

// Edit user form (admin only)
router.get('/:id/edit', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('User not found');
    }

    res.render('layout', {
      title: 'Edit User',
      body: 'users/edit',
      editUser: result.rows[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching user for edit:', error);
    res.status(500).send('Server error');
  }
});

// Update user (admin only)
router.post('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, confirm_password } = req.body;

    // Check if password was provided
    if (password) {
      // Validate password match
      if (password !== confirm_password) {
        const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
        return res.render('layout', {
          title: 'Edit User',
          body: 'users/edit',
          editUser: result.rows[0],
          error: 'Passwords do not match',
          user: req.session.user
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update user with new password
      await db.query(
        'UPDATE users SET name = $1, email = $2, role = $3, password = $4 WHERE id = $5',
        [name, email, role, hashedPassword, id]
      );
    } else {
      // Update user without changing password
      await db.query(
        'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4',
        [name, email, role, id]
      );
    }

    res.redirect('/users');
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).send('Server error');
  }
});

// Delete user (admin only)
router.post('/:id/delete', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (req.session.user.id === parseInt(id)) {
      return res.status(400).send('Cannot delete your own account');
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.redirect('/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send('Server error');
  }
});

// Settings routes
router.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // First check if the settings column exists
    let userSettings = {};
    try {
      const result = await db.query('SELECT id, name, email, role, settings FROM users WHERE id = $1', [userId]);
      userSettings = result.rows[0].settings || {};
    } catch (error) {
      // If column doesn't exist, use empty settings
      if (error.code === '42703') { // Column doesn't exist error
        console.log('Settings column does not exist yet, using default empty settings');

        // Create settings column
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb`);
      } else {
        throw error; // Re-throw other errors
      }
    }

    res.render('layout', {
      title: 'Settings',
      body: 'users/settings',
      user: {
        ...req.session.user,
        settings: userSettings
      },
      showUpdated: req.query.updated === 'true'
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).send('Server error');
  }
});

// Update display settings
router.post('/settings/display', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { theme, language } = req.body;

    // Ensure settings column exists
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb`);

    // Get current settings
    const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);
    let settings = userResult.rows[0]?.settings || {};

    // Update settings
    settings = {
      ...settings,
      theme: theme || 'light',
      language: language || 'en'
    };

    // Save to database
    await db.query('UPDATE users SET settings = $1 WHERE id = $2', [settings, userId]);

    // Update session
    req.session.user = {
      ...req.session.user,
      settings
    };

    res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating display settings:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Update security settings
router.post('/settings/security', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    // Check if passwords match
    if (new_password !== confirm_password) {
      return res.render('layout', {
        title: 'Settings',
        body: 'users/settings',
        error: 'New passwords do not match',
        user: req.session.user
      });
    }

    // Check current password
    const userResult = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password);

    if (!isMatch) {
      return res.render('layout', {
        title: 'Settings',
        body: 'users/settings',
        error: 'Current password is incorrect',
        user: req.session.user
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    return res.redirect('/users/settings?updated=true');
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
