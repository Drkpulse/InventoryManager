const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { hasPermission } = require('../middleware/permissions');
const userController = require('../controllers/userController');

// Get all users
router.get('/', hasPermission('users.view'), async (req, res) => {
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
router.get('/profile', hasPermission('users.view'), async (req, res) => {
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
router.post('/profile', hasPermission('users.edit'), async (req, res) => {
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

// Edit user form
router.get('/:id/edit', hasPermission('users.edit'), async (req, res) => {
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

// Update user
router.post('/:id', hasPermission('users.edit'), async (req, res) => {
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

// Delete user
router.post('/:id/delete', hasPermission('users.delete'), async (req, res) => {
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
router.get('/settings', hasPermission('users.view'), userController.getSettings);

// Update display settings
router.post('/settings/display', hasPermission('users.edit'), userController.updateDisplaySettings);

// Update notification settings
router.post('/settings/notifications', hasPermission('users.edit'), userController.updateNotificationSettings);

// Update security settings
router.post('/settings/security', hasPermission('users.edit'), userController.updateSecuritySettings);

module.exports = router;
