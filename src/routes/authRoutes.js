const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Login form
router.get('/login', (req, res) => {
  res.render('layout', {
    title: 'Login',
    body: 'auth/login',
    user: null
  });
});

// Register form
router.get('/register', (req, res) => {
  res.render('layout', {
    title: 'Register',
    body: 'auth/register',
    user: null
  });
});

// Login process
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', email);

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    console.log('User found:', result.rows.length > 0);

    if (result.rows.length === 0) {
      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        user: null
      });
    }

    const user = result.rows[0];
    console.log('Comparing passwords for user:', user.name);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        user: null
      });
    }

    // Save user to session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log('Login successful. User role:', user.role);

    res.redirect('/');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error');
  }
});

// Register process
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirm_password } = req.body;

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

    // Log user in
    req.session.user = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      email: result.rows[0].email,
      role: result.rows[0].role
    };

    res.redirect('/');

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Server error');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
