const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { hasPermission } = require('../middleware/permissions');
const userSetController = require('../controllers/userSetController');

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

// User profile page - accessible to any logged-in user
router.get('/profile', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  try {
    const userId = req.session.user.id;
    const result = await db.query(`
      SELECT id, name, email, role, cep_id, created_at, updated_at, last_login, active, settings
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.redirect('/auth/login');
    }

    res.render('layout', {
      title: 'My Profile',
      body: 'users/profile',
      profile: result.rows[0],
      user: req.session.user,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).send('Server error');
  }
});

// Update user profile - accessible to any logged-in user for their own profile
router.post('/profile', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  try {
    const userId = req.session.user.id;
    const { name, email } = req.body;

    await db.query(`
      UPDATE users
      SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [name, email, userId]);

    // Update session with new info
    req.session.user.name = name;
    req.session.user.email = email;

    res.redirect('/users/profile?success=Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.redirect('/users/profile?error=Failed to update profile');
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

// Settings routes - accessible to any logged-in user
router.get('/settings', userSetController.showSettings);
router.post('/settings/display', userSetController.updateDisplaySettings);

router.post('/settings/security', userSetController.updateSecuritySettings);


module.exports = router;
