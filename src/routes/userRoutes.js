const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Middleware to check if user is logged in and is an admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied');
};

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
router.get('/profile', async (req, res) => {
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
router.post('/profile', async (req, res) => {
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
    const { name, email, role } = req.body;

    await db.query(
      'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4',
      [name, email, role, id]
    );

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

module.exports = router;
