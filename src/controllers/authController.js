const db = require('../config/db');
const bcrypt = require('bcrypt');

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

    // Load user permissions and roles
    try {
      const permissionsResult = await db.query(
        'SELECT * FROM get_user_permissions($1)',
        [user.id]
      );

      const rolesResult = await db.query(
        'SELECT * FROM get_user_roles($1)',
        [user.id]
      );

      // Set user session with enhanced data
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Keep for backward compatibility
        permissions: permissionsResult.rows.map(row => row.permission_name),
        roles: rolesResult.rows,
        roleNames: rolesResult.rows.map(role => role.display_name),
        permissionsLoadedAt: Date.now()
      };

      // Update last login
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Log successful login with role info
      console.log(`User logged in successfully: ${email} with roles: ${req.session.user.roleNames.join(', ')}`);

    } catch (permissionError) {
      console.error('Error loading permissions during login:', permissionError);

      // Fallback to basic session without permissions
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: [],
        roles: [],
        roleNames: []
      };
    }

    if (req.isAjax) {
      return res.json({
        success: true,
        redirect: '/',
        user: {
          name: req.session.user.name,
          roles: req.session.user.roleNames
        }
      });
    }

    req.flash('success', 'Welcome back! You have been logged in successfully.');
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

exports.logout = async (req, res) => {
  try {
    const userName = req.session?.user?.name || 'Unknown';

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        req.flash('error', 'Error logging out');
        return res.redirect('/');
      }

      console.log(`User logged out: ${userName}`);
      res.redirect('/auth/login');
    });

  } catch (error) {
    console.error('Logout error:', error);
    req.flash('error', 'Error logging out');
    res.redirect('/');
  }
};

// Check authentication status (for AJAX calls)
exports.checkAuth = (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        roles: req.session.user.roleNames || [],
        permissions: req.session.user.permissions || []
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
};

// Refresh user permissions (useful after role changes)
exports.refreshPermissions = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    // Reload permissions and roles
    const permissionsResult = await db.query(
      'SELECT * FROM get_user_permissions($1)',
      [userId]
    );

    const rolesResult = await db.query(
      'SELECT * FROM get_user_roles($1)',
      [userId]
    );

    // Update session
    req.session.user.permissions = permissionsResult.rows.map(row => row.permission_name);
    req.session.user.roles = rolesResult.rows;
    req.session.user.roleNames = rolesResult.rows.map(role => role.display_name);
    req.session.user.permissionsLoadedAt = Date.now();

    console.log(`Refreshed permissions for user: ${req.session.user.name}`);

    res.json({
      success: true,
      message: 'Permissions refreshed',
      user: {
        roles: req.session.user.roleNames,
        permissions: req.session.user.permissions
      }
    });

  } catch (error) {
    console.error('Error refreshing permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh permissions'
    });
  }
};
