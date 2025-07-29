const db = require('../config/db');
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();


exports.loginForm = async (req, res) => {
  res.render('layout', {
    title: 'Login',
    body: 'auth/login',
    error: req.flash('error'),
    email: req.body.email || '',
    user: null
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      if (req.isAjax) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Email and password are required',
        email,
        user: null
      });
    }

    // Query for user
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (rows.length === 0) {
      console.log('User not found:', email);

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        email,
        user: null
      });
    }

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log('Password mismatch for user:', email);

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return res.render('layout', {
        title: 'Login',
        body: 'auth/login',
        error: 'Invalid email or password',
        email,
        user: null
      });
    }

    // Set user session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Log successful login
    console.log('User logged in successfully:', email);

    if (req.isAjax) {
      return res.json({
        success: true,
        redirect: '/'
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);

    if (req.isAjax) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred during login'
      });
    }

    res.render('layout', {
      title: 'Login',
      body: 'auth/login',
      error: 'An error occurred during login',
      email: req.body.email,
      user: null
    });
  }
};
