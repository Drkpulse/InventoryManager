// src/middleware/permissions.js
const db = require('../config/db');

// Check if user has specific permission
const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await db.query(
        'SELECT user_has_permission($1, $2) as has_permission',
        [req.session.user.id, permission]
      );

      if (!result.rows[0].has_permission) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        req.flash('error', 'You do not have permission to access this resource');
        return res.redirect('/dashboard');
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user has any of the specified permissions
const hasAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let hasAccess = false;
      for (const permission of permissions) {
        const result = await db.query(
          'SELECT user_has_permission($1, $2) as has_permission',
          [req.session.user.id, permission]
        );

        if (result.rows[0].has_permission) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        req.flash('error', 'You do not have permission to access this resource');
        return res.redirect('/dashboard');
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Load user permissions into session
const loadUserPermissions = async (req, res, next) => {
  try {
    if (req.session && req.session.user && !req.session.user.permissions) {
      const permissionsResult = await db.query(
        'SELECT * FROM get_user_permissions($1)',
        [req.session.user.id]
      );

      const rolesResult = await db.query(
        'SELECT * FROM get_user_roles($1)',
        [req.session.user.id]
      );

      req.session.user.permissions = permissionsResult.rows.map(row => row.permission_name);
      req.session.user.roles = rolesResult.rows;

      // Add permissions and roles to res.locals for templates
      res.locals.userPermissions = req.session.user.permissions || [];
      res.locals.userRoles = req.session.user.roles || [];
    } else if (req.session.user) {
      res.locals.userPermissions = req.session.user.permissions || [];
      res.locals.userRoles = req.session.user.roles || [];
    }

    next();
  } catch (error) {
    console.error('Error loading user permissions:', error);
    next();
  }
};

// Helper function to check permission in templates
const can = (permission) => {
  return (req) => {
    return req.session.user &&
           req.session.user.permissions &&
           req.session.user.permissions.includes(permission);
  };
};

// Helper function to check if user has any role
const hasRole = (roleName) => {
  return (req) => {
    return req.session.user &&
           req.session.user.roles &&
           req.session.user.roles.some(role => role.role_name === roleName);
  };
};

// Middleware to add helper functions to templates
const addPermissionHelpers = (req, res, next) => {
  res.locals.can = (permission) => can(permission)(req);
  res.locals.hasRole = (roleName) => hasRole(roleName)(req);
  res.locals.isSuperAdmin = () => hasRole('super_admin')(req);
  res.locals.isAdmin = () => hasRole('admin')(req) || hasRole('super_admin')(req);
  next();
};

module.exports = {
  hasPermission,
  hasAnyPermission,
  loadUserPermissions,
  addPermissionHelpers,
  can,
  hasRole
};
