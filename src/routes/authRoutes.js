const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Login form
router.get('/login', (req, res) => {
  res.render('layout', {
    title: 'Login',
    body: 'auth/login',
    user: null,
    error: null
  });
});

// Register form
router.get('/register', (req, res) => {
  res.render('layout', {
    title: 'Register',
    body: 'auth/register',
    user: null,
    error: null
  });
});

// Login process - FIXED VERSION
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Email and password are required',
        user: null,
        email: email || ''
      });
    }

    // Query for user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      console.log('User not found:', email);
      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        user: null,
        email: email
      });
    }

    const user = result.rows[0];
    console.log('User found:', user.name, 'Role:', user.role);

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        user: null,
        email: email
      });
    }

    // Create session - ENSURE session is properly saved
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('layout', {
          title: 'Login',
          body: 'auth/login',
          error: 'Login failed. Please try again.',
          user: null,
          email: email
        });
      }

      console.log('Login successful for:', user.name, 'Session ID:', req.sessionID);
      console.log('Session data:', req.session.user);

      // Redirect to home page
      return res.redirect('/');
    });

  } catch (error) {
    console.error('Login error:', error);
    res.render('layout', {
      title: 'Login',
      body: 'auth/login',
      error: 'An error occurred during login. Please try again.',
      user: null,
      email: req.body.email || ''
    });
  }
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
