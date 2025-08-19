const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.loginForm = async (req, res) => {
  res.render('layout', {
    title: 'Login',
    body: 'auth/login',
    error: req.flash('error'),
    email: req.body.email || req.body.login || '',
    user: null
  });
};

exports.login = async (req, res) => {
  try {
    const { email, login, password } = req.body;
    const loginInput = email || login; // Support both field names

    console.log('Login attempt:', {
      loginInput,
      isAjax: req.isAjax,
      headers: req.headers['x-requested-with'],
      contentType: req.headers['content-type'],
      body: req.body,
      bodyKeys: Object.keys(req.body)
    });

    // Validate input
    if (!loginInput || !password) {
      const errorMessage = 'Email/CEP ID and password are required';
      console.log('Validation failed:', { loginInput: !!loginInput, password: !!password });

      if (req.isAjax) {
        return res.status(400).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    // Query for user using the helper function (case-insensitive)
    const { rows } = await db.query('SELECT * FROM find_user_by_login($1)', [loginInput]);

    if (rows.length === 0) {
      console.log('User not found:', loginInput);
      const errorMessage = 'Invalid email/CEP ID or password';

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    const user = rows[0];

    // Check if user is active
    if (user.active === false) {
      console.log('Inactive user attempted login:', loginInput);
      const errorMessage = 'Account is disabled. Please contact administrator.';

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log('Password mismatch for user:', loginInput);
      const errorMessage = 'Invalid email/CEP ID or password';

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
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
        cep_id: user.cep_id,
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
      console.log(`User logged in successfully: ${loginInput} (${user.name}) with roles: ${req.session.user.roleNames.join(', ')}`);

    } catch (permissionError) {
      console.error('Error loading permissions during login:', permissionError);

      // Fallback to basic session without permissions
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        cep_id: user.cep_id,
        role: user.role,
        permissions: [],
        roles: [],
        roleNames: []
      };
    }

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during login:', err);
        console.error('Redis connected:', redisConnected);
        console.error('Session store type:', req.session.store?.constructor?.name);

        if (req.isAjax) {
          return res.status(500).json({
            success: false,
            message: 'Login failed due to session error. Please try again.'
          });
        }
        req.flash('error', 'Login failed due to session error. Please try again.');
        return res.redirect('/auth/login');
      }

      console.log('✅ Session saved successfully for user:', user.name);
      console.log('Session ID:', req.sessionID);

      if (req.isAjax) {
        return res.json({
          success: true,
          message: `Welcome back, ${user.name}!`,
          redirect: '/',
          user: {
            name: req.session.user.name,
            cep_id: req.session.user.cep_id,
            roles: req.session.user.roleNames
          }
        });
      }

      req.flash('success', `Welcome back, ${user.name}! You have been logged in successfully.`);
      res.redirect('/');
    });

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
      email: req.body.email || req.body.login,
      user: null
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userName = req.session?.user?.name || 'Unknown';
    const userCep = req.session?.user?.cep_id || 'Unknown';

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        req.flash('error', 'Error logging out');
        return res.redirect('/');
      }

      console.log(`User logged out: ${userName} (${userCep})`);
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
        cep_id: req.session.user.cep_id,
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

    console.log(`Refreshed permissions for user: ${req.session.user.name} (${req.session.user.cep_id})`);

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
