const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Add this import
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const multer = require('multer');
const upload = multer(); // Use memory storage for form-data parsing

// Login form
router.get('/login', authController.loginForm);

// Login process - Use the controller method
router.post('/login', authController.login);

// Register form
router.get('/register', (req, res) => {
  res.render('layout', {
    title: 'Register',
    body: 'auth/register',
    user: null,
    error: null
  });
});

// Register process
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirm_password } = req.body;

    // Validate input
    if (!name || !email || !password || !confirm_password) {
      return res.render('layout', {
        title: 'Register',
        body: 'auth/register',
        error: 'All fields are required',
        user: null
      });
    }

    if (password !== confirm_password) {
      return res.render('layout', {
        title: 'Register',
        body: 'auth/register',
        error: 'Passwords do not match',
        user: null
      });
    }

    // Check if user already exists
    const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (checkUser.rows.length > 0) {
      return res.render('layout', {
        title: 'Register',
        body: 'auth/register',
        error: 'Email already in use',
        user: null
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, 'user']
    );

    const newUser = result.rows[0];

    // Log user in automatically
    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error after registration:', err);
        return res.render('layout', {
          title: 'Register',
          body: 'auth/register',
          error: 'Registration successful but login failed. Please try logging in.',
          user: null
        });
      }

      console.log('Registration and login successful for:', newUser.name);
      return res.redirect('/');
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.render('layout', {
      title: 'Register',
      body: 'auth/register',
      error: 'An error occurred during registration. Please try again.',
      user: null
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
