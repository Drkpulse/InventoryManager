const { hasPermission } = require('./permissions');

const isAdmin = async (req, res, next) => {
  try {
    if (!req.session.user) {
      req.flash('error', 'Please log in to access admin features');
      return res.redirect('/auth/login');
    }

    // Check if user has any admin permissions
    const adminPermissions = [
      'users.view', 'roles.view', 'admin.settings', 'admin.logs'
    ];

    let hasAdminAccess = false;

    if (req.session.user.permissions) {
      hasAdminAccess = adminPermissions.some(permission =>
        req.session.user.permissions.includes(permission)
      );
    }

    if (!hasAdminAccess) {
      req.flash('error', 'You do not have permission to access admin features');
      return res.redirect('/dashboard');
    }

    next();
  } catch (error) {
    console.error('Admin permission check error:', error);
    req.flash('error', 'Authentication error');
    res.redirect('/auth/login');
  }
};

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Example updated auth controller for login to load permissions
const authController = {
  async processLogin(req, res) {
    try {
      // After successful authentication, load user permissions
      const db = require('../config/db');

      const permissionsResult = await db.query(
        'SELECT * FROM get_user_permissions($1)',
        [user.id]
      );

      const rolesResult = await db.query(
        'SELECT * FROM get_user_roles($1)',
        [user.id]
      );

      // Store user data with permissions in session
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Keep for backward compatibility
        permissions: permissionsResult.rows.map(row => row.permission_name),
        roles: rolesResult.rows
      };

      // Update last login
      await db.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      req.flash('success', 'Login successful');
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      req.flash('error', 'Login failed');
      res.redirect('/auth/login');
    }
  }
};

module.exports = {
  isAuthenticated,
  isAdmin,
  authController
};
