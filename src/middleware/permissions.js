// src/middleware/permissions.js
const db = require('../config/db');

/**
 * Load user permissions and roles into session
 */
const loadUserPermissions = async (req, res, next) => {
  try {
    if (req.session && req.session.user && req.session.user.id) {
      // Only load permissions if they're not already loaded or if it's been more than 5 minutes
      const shouldReload = !req.session.user.permissions ||
                          !req.session.user.permissionsLoadedAt ||
                          (Date.now() - req.session.user.permissionsLoadedAt) > 5 * 60 * 1000;

      if (shouldReload) {
        try {
          // Load user permissions
          const permissionsResult = await db.query(
            'SELECT * FROM get_user_permissions($1)',
            [req.session.user.id]
          );

          // Load user roles
          const rolesResult = await db.query(
            'SELECT * FROM get_user_roles($1)',
            [req.session.user.id]
          );

          // Update session with permissions and roles
          req.session.user.permissions = permissionsResult.rows.map(row => row.permission_name);
          req.session.user.roles = rolesResult.rows;
          req.session.user.roleNames = rolesResult.rows.map(role => role.display_name);
          req.session.user.permissionsLoadedAt = Date.now();

          console.log(`Loaded ${req.session.user.permissions.length} permissions for user ${req.session.user.name}`);
        } catch (error) {
          console.error('Error loading user permissions:', error);
          // Continue without failing - use legacy role system as fallback
          req.session.user.permissions = [];
          req.session.user.roles = [];
          req.session.user.roleNames = [];
        }
      }
    }
    next();
  } catch (error) {
    console.error('Permission loading middleware error:', error);
    next();
  }
};

/**
 * Add permission helper functions to templates
 */
const addPermissionHelpers = (req, res, next) => {
  // Add permission checking function to response locals
  res.locals.userCan = (permission) => {
    if (!req.session || !req.session.user) return false;

    // Check if user has specific permission
    if (req.session.user.permissions && req.session.user.permissions.includes(permission)) {
      return true;
    }

    // Fallback to legacy role system
    if (req.session.user.role === 'admin') {
      return true;
    }

    return false;
  };

  res.locals.can = res.locals.userCan;

  // Add role checking function
  res.locals.userHasRole = (roleName) => {
    if (!req.session || !req.session.user) return false;

    if (req.session.user.roles) {
      return req.session.user.roles.some(role => role.role_name === roleName);
    }

    // Fallback to legacy role system
    return req.session.user.role === roleName;
  };

  res.locals.hasRole = res.locals.userHasRole;

  // Add multiple permission checking function
  res.locals.userCanAny = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.some(permission => res.locals.userCan(permission));
  };

    res.locals.canAny = res.locals.userCanAny;

  // Add admin checking function
  res.locals.userIsAdmin = () => {
    if (!req.session || !req.session.user) return false;

    const adminPermissions = [
      'users.view', 'roles.view', 'admin.settings', 'admin.logs'
    ];

    return adminPermissions.some(permission => res.locals.userCan(permission));
  };

  res.locals.isAdmin = res.locals.userIsAdmin;

  // Add current user roles for display
  res.locals.userRoles = req.session?.user?.roleNames || [];

  // Debug: Log what permissions are available
  if (req.session?.user?.permissions) {
    console.log(`Template helpers: User ${req.session.user.name} has permissions: ${req.session.user.permissions.join(', ')}`);
  }

  next();
};

/**
 * Middleware to check if user has specific permission
 */
const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in to access this feature');
        return res.redirect('/auth/login');
      }

      // Check permission using database function
      const result = await db.query(
        'SELECT user_has_permission($1, $2) as has_permission',
        [req.session.user.id, permission]
      );

      if (result.rows[0].has_permission) {
        return next();
      }

      // Log unauthorized access attempt
      console.warn(`Unauthorized access attempt: User ${req.session.user.name} (ID: ${req.session.user.id}) tried to access ${permission}`);

      req.flash('error', `You don't have permission to ${permission.replace('.', ' ').replace('_', ' ')}`);
      return res.redirect('/dashboard');

    } catch (error) {
      console.error('Permission check error:', error);
      req.flash('error', 'Permission check failed');
      return res.redirect('/dashboard');
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 */
const hasAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in to access this feature');
        return res.redirect('/auth/login');
      }

      if (!Array.isArray(permissions)) {
        permissions = [permissions];
      }

      // Check each permission
      for (const permission of permissions) {
        const result = await db.query(
          'SELECT user_has_permission($1, $2) as has_permission',
          [req.session.user.id, permission]
        );

        if (result.rows[0].has_permission) {
          return next();
        }
      }

      console.warn(`Unauthorized access attempt: User ${req.session.user.name} (ID: ${req.session.user.id}) tried to access one of: ${permissions.join(', ')}`);

      req.flash('error', 'You don\'t have permission to access this feature');
      return res.redirect('/dashboard');

    } catch (error) {
      console.error('Permission check error:', error);
      req.flash('error', 'Permission check failed');
      return res.redirect('/dashboard');
    }
  };
};

/**
 * Middleware to check if user has all specified permissions
 */
const hasAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in to access this feature');
        return res.redirect('/auth/login');
      }

      if (!Array.isArray(permissions)) {
        permissions = [permissions];
      }

      // Check all permissions
      for (const permission of permissions) {
        const result = await db.query(
          'SELECT user_has_permission($1, $2) as has_permission',
          [req.session.user.id, permission]
        );

        if (!result.rows[0].has_permission) {
          console.warn(`Unauthorized access attempt: User ${req.session.user.name} (ID: ${req.session.user.id}) missing permission: ${permission}`);

          req.flash('error', `You don't have permission to ${permission.replace('.', ' ').replace('_', ' ')}`);
          return res.redirect('/dashboard');
        }
      }

      return next();

    } catch (error) {
      console.error('Permission check error:', error);
      req.flash('error', 'Permission check failed');
      return res.redirect('/dashboard');
    }
  };
};

/**
 * Check if user has role
 */
const hasRole = (roleName) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        req.flash('error', 'Please log in to access this feature');
        return res.redirect('/auth/login');
      }

      const result = await db.query(`
        SELECT EXISTS(
          SELECT 1 FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = $1 AND r.name = $2
        ) as has_role
      `, [req.session.user.id, roleName]);

      if (result.rows[0].has_role) {
        return next();
      }

      console.warn(`Unauthorized access attempt: User ${req.session.user.name} (ID: ${req.session.user.id}) missing role: ${roleName}`);

      req.flash('error', `You need ${roleName} role to access this feature`);
      return res.redirect('/dashboard');

    } catch (error) {
      console.error('Role check error:', error);
      req.flash('error', 'Role check failed');
      return res.redirect('/dashboard');
    }
  };
};

/**
 * Admin middleware (legacy support)
 */
const isAdmin = hasAnyPermission(['users.view', 'roles.view', 'admin.settings', 'admin.logs']);

module.exports = {
  loadUserPermissions,
  addPermissionHelpers,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isAdmin
};
