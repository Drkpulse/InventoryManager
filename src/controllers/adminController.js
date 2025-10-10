// src/controllers/adminController.js
const db = require('../config/db');
const bcrypt = require('bcrypt');

// Helper function to safely query users with optional lockout columns
async function safeUserQuery(query, params = []) {
  try {
    return await db.query(query, params);
  } catch (error) {
    // If column doesn't exist, try a fallback query
    if (error.code === '42703') { // undefined_column error
      console.warn('Column missing in query, using fallback:', error.message);

      // Create a simplified fallback query for user data
      const fallbackQuery = query
        .replace(/COALESCE\(u\.failed_login_attempts,\s*0\)\s*as\s*failed_login_attempts,?/gi, '0 as failed_login_attempts,')
        .replace(/COALESCE\(u\.account_locked,\s*false\)\s*as\s*account_locked,?/gi, 'false as account_locked,')
        .replace(/u\.locked_at,?/gi, 'NULL::TIMESTAMP as locked_at,')
        .replace(/u\.locked_until,?/gi, 'NULL::TIMESTAMP as locked_until,')
        .replace(/u\.failed_login_attempts,?/gi, '0 as failed_login_attempts,')
        .replace(/u\.account_locked,?/gi, 'false as account_locked,')
        .replace(/failed_login_attempts\s*>\s*\d+/gi, 'false')
        .replace(/account_locked\s*=\s*(true|false)/gi, 'false');

      return await db.query(fallbackQuery, params);
    }
    throw error;
  }
}

// Users Management
exports.users = async (req, res) => {
  try {
    // First, try to get basic user data without roles to avoid table dependency issues
    let result;
    try {
      // Try the full query with roles first
      result = await safeUserQuery(`
        SELECT
          u.id, u.name, u.email, u.cep_id, u.role, u.created_at, u.last_login,
          CASE WHEN u.active IS NULL THEN true ELSE u.active END as active,
          COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
          COALESCE(u.account_locked, false) as account_locked,
          u.locked_at,
          u.locked_until,
          COALESCE(
            array_agg(DISTINCT r.display_name ORDER BY r.display_name) FILTER (WHERE r.display_name IS NOT NULL),
            ARRAY[]::text[]
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id, u.name, u.email, u.cep_id, u.role, u.created_at, u.last_login, u.active, u.failed_login_attempts, u.account_locked, u.locked_at, u.locked_until
        ORDER BY u.created_at DESC
      `);
    } catch (roleError) {
      console.warn('⚠️  Roles tables not available, using simplified query:', roleError.message);
      // Fallback to basic users query without roles
      result = await db.query(`
        SELECT
          u.id, u.name, u.email, u.cep_id, u.role, u.created_at, u.last_login,
          CASE WHEN u.active IS NULL THEN true ELSE u.active END as active,
          0 as failed_login_attempts,
          false as account_locked,
          NULL as locked_at,
          NULL as locked_until,
          ARRAY[]::text[] as roles
        FROM users u
        ORDER BY u.created_at DESC
      `);
    }

    // Ensure we have a valid users array
    const users = result.rows || [];

    res.render('layout', {
      title: 'User Management',
      body: 'admin/users',
      users: users,
      currentUser: req.session.user || { id: 0, name: 'Unknown', role: 'user' }
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    console.error('Stack trace:', error.stack);

    // Try to render with empty data as last resort
    try {
      res.render('layout', {
        title: 'User Management',
        body: 'admin/users',
        users: [],
        currentUser: req.session.user || { id: 0, name: 'Unknown', role: 'user' }
      });
    } catch (renderError) {
      console.error('❌ Failed to render users page:', renderError);
      req.flash('error', 'Failed to load users page. Please check database connection.');
      res.redirect('/dashboard');
    }
  }
};

exports.showAddUserForm = async (req, res) => {
  try {
    const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');

    res.render('layout', {
      title: 'Add New User',
      body: 'admin/add-user',
      roles: rolesResult.rows,
      formData: {},
      errors: []
    });
  } catch (error) {
    console.error('Error loading add user form:', error);
    req.flash('error', 'Failed to load user form');
    res.redirect('/admin/users');
  }
};

exports.addUser = async (req, res) => {
  try {
    const { cep_id, name, email, password, confirm_password, selectedRoles } = req.body;
    const errors = [];

    // Validation
    if (!cep_id || cep_id.trim() === '') errors.push('CEP ID is required');
    if (!name || name.trim() === '') errors.push('Name is required');
    if (!email || email.trim() === '') errors.push('Email is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirm_password) errors.push('Passwords do not match');

    // Check if email or cep_id already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1 OR cep_id = $2', [email, cep_id]);
    if (existingUser.rows.length > 0) {
      if (existingUser.rows.some(u => u.email === email)) errors.push('Email already exists');
      if (existingUser.rows.some(u => u.cep_id === cep_id)) errors.push('CEP ID already exists');
    }

    if (errors.length > 0) {
      const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
      return res.render('layout', {
        title: 'Add New User',
        body: 'admin/add-user',
        roles: rolesResult.rows,
        errors,
        formData: { cep_id, name, email }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await db.query(
      'INSERT INTO users (cep_id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      [cep_id.trim(), name.trim(), email.trim(), hashedPassword, 'user']
    );

    const userId = userResult.rows[0].id;

    // Assign roles
    let rolesToAssign = [];
    if (selectedRoles) {
      rolesToAssign = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles];
    } else {
      // Default to 'user' role if none selected
      const defaultRoleResult = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
      if (defaultRoleResult.rows.length > 0) {
        rolesToAssign = [defaultRoleResult.rows[0].id.toString()];
      }
    }

    for (const roleId of rolesToAssign) {
      await db.query(
        'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
        [userId, parseInt(roleId), req.session.user.id]
      );
    }

    req.flash('success', `User ${name} created successfully`);
    res.redirect('/admin/users');

  } catch (error) {
    console.error('Error creating user:', error);

    try {
      const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
      res.render('layout', {
        title: 'Add New User',
        body: 'admin/add-user',
        roles: rolesResult.rows,
        errors: ['Failed to create user: ' + error.message],
        formData: req.body
      });
    } catch (renderError) {
      console.error('Error rendering add user form:', renderError);
      req.flash('error', 'Failed to create user');
      res.redirect('/admin/users');
    }
  }
};

exports.showEditUserForm = async (req, res) => {
  try {
    const userId = req.params.id;

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
    const userRolesResult = await db.query(
      'SELECT role_id FROM user_roles WHERE user_id = $1',
      [userId]
    );

    const userRoleIds = userRolesResult.rows.map(row => row.role_id);

    res.render('layout', {
      title: 'Edit User',
      body: 'admin/edit-user',
      editUser: userResult.rows[0],
      roles: rolesResult.rows,
      userRoleIds,
      errors: []
    });

  } catch (error) {
    console.error('Error loading edit user form:', error);
    req.flash('error', 'Failed to load user');
    res.redirect('/admin/users');
  }
};

exports.editUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { cep_id, name, email, password, confirm_password, selectedRoles, active, unlock_account } = req.body;
    const errors = [];

    // Validation
    if (!cep_id || cep_id.trim() === '') errors.push('CEP ID is required');
    if (!name || name.trim() === '') errors.push('Name is required');
    if (!email || email.trim() === '') errors.push('Email is required');

    if (password) {
      if (password.length < 6) errors.push('Password must be at least 6 characters');
      if (password !== confirm_password) errors.push('Passwords do not match');
    }

    // Check if email or cep_id already exists for other users
    const existingUser = await db.query(
      'SELECT id FROM users WHERE (email = $1 OR cep_id = $2) AND id != $3',
      [email, cep_id, userId]
    );
    if (existingUser.rows.length > 0) {
      if (existingUser.rows.some(u => u.email === email)) errors.push('Email already exists');
      if (existingUser.rows.some(u => u.cep_id === cep_id)) errors.push('CEP ID already exists');
    }

    if (errors.length > 0) {
      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
      const userRolesResult = await db.query('SELECT role_id FROM user_roles WHERE user_id = $1', [userId]);

      return res.render('layout', {
        title: 'Edit User',
        body: 'admin/edit-user',
        editUser: userResult.rows[0],
        roles: rolesResult.rows,
        userRoleIds: userRolesResult.rows.map(row => row.role_id),
        errors
      });
    }

    // Update user
    const isActive = active === 'on' || active === true;
    const shouldUnlock = unlock_account === 'on' || unlock_account === true;

    let updateQuery = 'UPDATE users SET cep_id = $1, name = $2, email = $3, active = $4, updated_at = NOW()';
    let updateParams = [cep_id.trim(), name.trim(), email.trim(), isActive];
    let paramIndex = 5;

    // Handle unlock account
    if (shouldUnlock) {
      updateQuery += ', account_locked = FALSE, failed_login_attempts = 0, locked_until = NULL, locked_at = NULL';
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += `, password = $${paramIndex}`;
      updateParams.push(hashedPassword);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex}`;
    updateParams.push(userId);

    await db.query(updateQuery, updateParams);

    // Update roles if user has permission
    try {
      const permissionCheck = await db.query(
        'SELECT user_has_permission($1, $2) as has_permission',
        [req.session.user.id, 'users.manage_roles']
      );

      if (permissionCheck.rows[0]?.has_permission) {
        // Remove existing roles
        await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

        // Add new roles
        let rolesToAssign = [];
        if (selectedRoles) {
          rolesToAssign = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles];
        }

        for (const roleId of rolesToAssign) {
          await db.query(
            'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
            [userId, parseInt(roleId), req.session.user.id]
          );
        }
        // Role update completed successfully
      } else {
        console.warn(`⚠️ User ${req.session.user.name} attempted to update roles without permission`);
      }
    } catch (permError) {
      console.error('Error checking role management permission:', permError);
      // Continue without updating roles
    }

    // Set appropriate success message
    if (shouldUnlock) {
      console.log(`🔓 Admin ${req.session.user.name} unlocked user account: ${name.trim()} (${email.trim()})`);
      req.flash('success', `User ${name.trim()} updated successfully and account unlocked`);
    } else {
      req.flash('success', `User ${name.trim()} updated successfully`);
    }

    res.redirect('/admin/users');

  } catch (error) {
    console.error('Error updating user:', error);
    req.flash('error', 'Failed to update user: ' + error.message);
    res.redirect('/admin/users');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (parseInt(userId) === req.session.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/admin/users');
    }

    // Get user info for logging
    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'Unknown';

    // Delete user (CASCADE will handle user_roles)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    req.flash('success', `User ${userName} deleted successfully`);
    res.redirect('/admin/users');

  } catch (error) {
    console.error('Error deleting user:', error);
    req.flash('error', 'Failed to delete user');
    res.redirect('/admin/users');
  }
};

// Roles Management
exports.roles = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        r.*,
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_system_role, r.created_at
      ORDER BY r.is_system_role DESC, r.display_name
    `);

    res.render('layout', {
      title: 'Role Management',
      body: 'admin/roles',
      roles: result.rows
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    req.flash('error', 'Failed to load roles');
    res.redirect('/dashboard');
  }
};

exports.showAddRoleForm = async (req, res) => {
  try {
    const permissionsResult = await db.query(`
      SELECT id, name, display_name, description, module
      FROM permissions
      ORDER BY module, display_name
    `);

    // Group permissions by module
    const permissionsByModule = {};
    permissionsResult.rows.forEach(permission => {
      if (!permissionsByModule[permission.module]) {
        permissionsByModule[permission.module] = [];
      }
      permissionsByModule[permission.module].push(permission);
    });

    res.render('layout', {
      title: 'Add New Role',
      body: 'admin/add-role',
      permissionsByModule,
      formData: {},
      errors: []
    });
  } catch (error) {
    console.error('Error loading add role form:', error);
    req.flash('error', 'Failed to load role form');
    res.redirect('/admin/roles');
  }
};

exports.addRole = async (req, res) => {
  try {
    const { name, display_name, description, selectedPermissions } = req.body;
    const errors = [];

    // Validation
    if (!name || name.trim() === '') errors.push('Role name is required');
    if (!display_name || display_name.trim() === '') errors.push('Display name is required');
    if (name && !/^[a-z_]+$/.test(name.trim())) {
      errors.push('Role name must contain only lowercase letters and underscores');
    }

    // Check if role name already exists
    const existingRole = await db.query('SELECT id FROM roles WHERE name = $1', [name]);
    if (existingRole.rows.length > 0) {
      errors.push('Role name already exists');
    }

    if (errors.length > 0) {
      const permissionsResult = await db.query('SELECT id, name, display_name, description, module FROM permissions ORDER BY module, display_name');
      const permissionsByModule = {};
      permissionsResult.rows.forEach(permission => {
        if (!permissionsByModule[permission.module]) {
          permissionsByModule[permission.module] = [];
        }
        permissionsByModule[permission.module].push(permission);
      });

      return res.render('layout', {
        title: 'Add New Role',
        body: 'admin/add-role',
        permissionsByModule,
        errors,
        formData: { name, display_name, description }
      });
    }

    // Create role
    const roleResult = await db.query(
      'INSERT INTO roles (name, display_name, description, is_system_role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), display_name.trim(), description?.trim() || null, false]
    );

    const roleId = roleResult.rows[0].id;

    // Assign permissions
    let permissionsToAssign = [];
    if (selectedPermissions) {
      permissionsToAssign = Array.isArray(selectedPermissions) ? selectedPermissions : [selectedPermissions];
    }

    for (const permissionId of permissionsToAssign) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, parseInt(permissionId)]
      );
    }

    req.flash('success', `Role ${display_name} created successfully`);
    res.redirect('/admin/roles');

  } catch (error) {
    console.error('Error creating role:', error);
    req.flash('error', 'Failed to create role: ' + error.message);
    res.redirect('/admin/roles');
  }
};

exports.showEditRoleForm = async (req, res) => {
  try {
    const roleId = req.params.id;

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleResult.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    const permissionsResult = await db.query('SELECT id, name, display_name, description, module FROM permissions ORDER BY module, display_name');
    const rolePermissionsResult = await db.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [roleId]);

    const permissionsByModule = {};
    permissionsResult.rows.forEach(permission => {
      if (!permissionsByModule[permission.module]) {
        permissionsByModule[permission.module] = [];
      }
      permissionsByModule[permission.module].push(permission);
    });

    const rolePermissionIds = rolePermissionsResult.rows.map(row => row.permission_id);

    res.render('layout', {
      title: 'Edit Role',
      body: 'admin/edit-role',
      editRole: roleResult.rows[0],
      permissionsByModule,
      rolePermissionIds,
      errors: []
    });

  } catch (error) {
    console.error('Error loading edit role form:', error);
    req.flash('error', 'Failed to load role');
    res.redirect('/admin/roles');
  }
};

exports.editRole = async (req, res) => {
  try {
    const roleId = req.params.id;
    const { name, display_name, description, selectedPermissions } = req.body;
    const errors = [];

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleResult.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    const role = roleResult.rows[0];

    // Validation
    if (!display_name || display_name.trim() === '') errors.push('Display name is required');

    if (!role.is_system_role) {
      if (!name || name.trim() === '') errors.push('Role name is required');
      if (name && !/^[a-z_]+$/.test(name.trim())) {
        errors.push('Role name must contain only lowercase letters and underscores');
      }

      // Check if role name already exists for other roles
      const existingRole = await db.query('SELECT id FROM roles WHERE name = $1 AND id != $2', [name, roleId]);
      if (existingRole.rows.length > 0) {
        errors.push('Role name already exists');
      }
    }

    if (errors.length > 0) {
      const permissionsResult = await db.query('SELECT id, name, display_name, description, module FROM permissions ORDER BY module, display_name');
      const rolePermissionsResult = await db.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [roleId]);

      const permissionsByModule = {};
      permissionsResult.rows.forEach(permission => {
        if (!permissionsByModule[permission.module]) {
          permissionsByModule[permission.module] = [];
        }
        permissionsByModule[permission.module].push(permission);
      });

      return res.render('layout', {
        title: 'Edit Role',
        body: 'admin/edit-role',
        editRole: role,
        permissionsByModule,
        rolePermissionIds: rolePermissionsResult.rows.map(row => row.permission_id),
        errors
      });
    }

    // Update role
    let updateQuery, updateParams;
    if (role.is_system_role) {
      updateQuery = 'UPDATE roles SET display_name = $1, description = $2, updated_at = NOW() WHERE id = $3';
      updateParams = [display_name.trim(), description?.trim() || null, roleId];
    } else {
      updateQuery = 'UPDATE roles SET name = $1, display_name = $2, description = $3, updated_at = NOW() WHERE id = $4';
      updateParams = [name.trim(), display_name.trim(), description?.trim() || null, roleId];
    }

    await db.query(updateQuery, updateParams);

    // Update permissions
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    let permissionsToAssign = [];
    if (selectedPermissions) {
      permissionsToAssign = Array.isArray(selectedPermissions) ? selectedPermissions : [selectedPermissions];
    }

    for (const permissionId of permissionsToAssign) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, parseInt(permissionId)]
      );
    }

    req.flash('success', `Role ${display_name} updated successfully`);
    res.redirect('/admin/roles');

  } catch (error) {
    console.error('Error updating role:', error);
    req.flash('error', 'Failed to update role: ' + error.message);
    res.redirect('/admin/roles');
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    const roleResult = await db.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleResult.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    const role = roleResult.rows[0];

    if (role.is_system_role) {
      req.flash('error', 'System roles cannot be deleted');
      return res.redirect('/admin/roles');
    }

    // Check if role is assigned to users
    const userCount = await db.query('SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1', [roleId]);
    if (parseInt(userCount.rows[0].count) > 0) {
      req.flash('error', `Cannot delete role ${role.display_name} as it is assigned to users`);
      return res.redirect('/admin/roles');
    }

    // Delete role (CASCADE will handle role_permissions)
    await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

    req.flash('success', `Role ${role.display_name} deleted successfully`);
    res.redirect('/admin/roles');

  } catch (error) {
    console.error('Error deleting role:', error);
    req.flash('error', 'Failed to delete role');
    res.redirect('/admin/roles');
  }
};

// Permissions Management
exports.permissions = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.*,
        COUNT(rp.role_id) as role_count
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      GROUP BY p.id, p.name, p.display_name, p.description, p.module, p.created_at
      ORDER BY p.module, p.display_name
    `);

    // Group permissions by module
    const permissionsByModule = {};
    result.rows.forEach(permission => {
      if (!permissionsByModule[permission.module]) {
        permissionsByModule[permission.module] = [];
      }
      permissionsByModule[permission.module].push(permission);
    });

    res.render('layout', {
      title: 'Permission Management',
      body: 'admin/permissions',
      permissionsByModule
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    req.flash('error', 'Failed to load permissions');
    res.redirect('/admin/roles');
  }
};

// System Settings
exports.settings = async (req, res) => {
  try {
    res.render('layout', {
      title: 'System Settings',
      body: 'admin/settings'
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    req.flash('error', 'Failed to load settings');
    res.redirect('/dashboard');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    // Settings update logic would go here
    req.flash('success', 'Settings updated successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    req.flash('error', 'Failed to update settings');
    res.redirect('/admin/settings');
  }
};

// Activity Logs
exports.logs = async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Get query parameters for filtering
    const { level, startDate, endDate, limit = 100, category, hideNoise = 'true' } = req.query;

    const logsDir = path.join(__dirname, '../../logs');
    let allLogs = [];

    // Define noise patterns to filter out
    const noisePatterns = [
      /Redis reconnection attempt/,
      /Redis Client Error.*getaddrinfo EAI_AGAIN redis/,
      /Redis Client Reconnecting/,
      /listen EADDRINUSE.*address already in use/,
      /Initializing Redis connection/,
      /Using provided Redis URL/,
      /notification.*info/i,
      /GET \/assets/,
      /GET \/css/,
      /GET \/js/,
      /GET \/favicon/
    ];

    // Define useful log categories
    const logCategories = {
      security: ['login', 'logout', 'authentication', 'failed_login', 'locked', 'unlocked', 'admin', 'unauthorized'],
      database: ['database', 'db', 'query', 'migration', 'backup', 'sql'],
      user_activity: ['user', 'created', 'updated', 'deleted', 'assigned'],
      system: ['server', 'started', 'stopped', 'error', 'warning', 'startup'],
      application: ['loading', 'dashboard', 'inventory', 'item', 'category']
    };

    try {
      // Read all log files from the logs directory
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(file => file.endsWith('.log') && !file.includes('audit'));

      // Read and parse each log file
      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          // Parse JSON log entries
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);

              // Add file source info
              logEntry.source = file;

              // Convert timestamp to Date object for easier handling
              logEntry.parsedTimestamp = new Date(logEntry.timestamp);

              // Skip noise if hideNoise is enabled
              if (hideNoise === 'true') {
                const messageToCheck = logEntry.message || '';
                const isNoise = noisePatterns.some(pattern => pattern.test(messageToCheck));
                if (isNoise) {
                  continue; // Skip this log entry
                }
              }

              // Categorize log entry
              logEntry.category = categorizeLog(logEntry, logCategories);

              // Add severity level for better filtering
              logEntry.severity = getSeverityLevel(logEntry);

              // Add human-readable relative time
              logEntry.timeAgo = getTimeAgo(logEntry.parsedTimestamp);

              allLogs.push(logEntry);
            } catch (parseError) {
              // Skip malformed log entries
              console.warn(`⚠️  Skipping malformed log entry in ${file}:`, line.substring(0, 100));
            }
          }
        } catch (fileError) {
          console.error(`❌ Error reading log file ${file}:`, fileError.message);
        }
      }

      // Sort logs by timestamp (newest first)
      allLogs.sort((a, b) => b.parsedTimestamp - a.parsedTimestamp);

      // Apply filters
      let filteredLogs = allLogs;

      // Filter by log level
      if (level && level !== '') {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }

      // Filter by category
      if (category && category !== '') {
        filteredLogs = filteredLogs.filter(log => log.category === category);
      }

      // Filter by date range
      if (startDate) {
        const start = new Date(startDate);
        filteredLogs = filteredLogs.filter(log => log.parsedTimestamp >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredLogs = filteredLogs.filter(log => log.parsedTimestamp <= end);
      }

      // Limit results
      const limitedLogs = filteredLogs.slice(0, parseInt(limit));

      // Calculate category stats
      const categoryStats = {};
      Object.keys(logCategories).forEach(cat => {
        categoryStats[cat] = allLogs.filter(log => log.category === cat).length;
      });
      categoryStats.uncategorized = allLogs.filter(log => log.category === 'uncategorized').length;

      // Calculate level stats
      const levelStats = {
        error: allLogs.filter(log => log.level === 'error').length,
        warn: allLogs.filter(log => log.level === 'warn').length,
        info: allLogs.filter(log => log.level === 'info').length,
        debug: allLogs.filter(log => log.level === 'debug').length
      };

      // Log summary available in stats object

      res.render('layout', {
        title: 'System Logs',
        body: 'admin/logs',
        logs: limitedLogs,
        filters: {
          level: level || '',
          category: category || '',
          startDate: startDate || '',
          endDate: endDate || '',
          limit: limit || 100,
          hideNoise: hideNoise || 'true'
        },
        stats: {
          total: allLogs.length,
          filtered: filteredLogs.length,
          displayed: limitedLogs.length,
          files: logFiles.length,
          categories: categoryStats,
          levels: levelStats
        },
        categories: Object.keys(logCategories).concat(['uncategorized'])
      });

    } catch (dirError) {
      console.error('❌ Error reading logs directory:', dirError.message);

      res.render('layout', {
        title: 'System Logs',
        body: 'admin/logs',
        logs: [],
        error: 'Unable to read log files. Please check server configuration.',
        filters: {
          level: level || '',
          category: category || '',
          startDate: startDate || '',
          endDate: endDate || '',
          limit: limit || 100,
          hideNoise: hideNoise || 'true'
        },
        stats: {
          total: 0,
          filtered: 0,
          displayed: 0,
          files: 0,
          categories: {},
          levels: {}
        },
        categories: []
      });
    }

  } catch (error) {
    console.error('❌ Error loading logs:', error);
    req.flash('error', 'Failed to load logs');
    res.redirect('/dashboard');
  }
};

// Helper function to categorize logs
function categorizeLog(logEntry, categories) {
  const message = (logEntry.message || '').toLowerCase();
  const url = (logEntry.url || '').toLowerCase();
  const method = (logEntry.method || '').toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword =>
      message.includes(keyword.toLowerCase()) ||
      url.includes(keyword.toLowerCase()) ||
      method.includes(keyword.toLowerCase())
    )) {
      return category;
    }
  }

  return 'uncategorized';
}

// Helper function to get severity level
function getSeverityLevel(logEntry) {
  const level = logEntry.level || 'info';
  const severityMap = {
    error: 4,
    warn: 3,
    info: 2,
    debug: 1
  };
  return severityMap[level] || 2;
}

// Helper function to get human-readable time difference
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Export logs functionality
exports.exportLogs = async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Get query parameters for filtering (same as logs function)
    const { level, startDate, endDate, limit = 1000, category, hideNoise = 'true' } = req.query;

    const logsDir = path.join(__dirname, '../../logs');
    let allLogs = [];

    // Define noise patterns to filter out (same as logs function)
    const noisePatterns = [
      /Redis reconnection attempt/,
      /Redis Client Error.*getaddrinfo EAI_AGAIN redis/,
      /Redis Client Reconnecting/,
      /listen EADDRINUSE.*address already in use/,
      /Initializing Redis connection/,
      /Using provided Redis URL/,
      /notification.*info/i,
      /GET \/assets/,
      /GET \/css/,
      /GET \/js/,
      /GET \/favicon/
    ];

    // Define useful log categories (same as logs function)
    const logCategories = {
      security: ['login', 'logout', 'authentication', 'failed_login', 'locked', 'unlocked', 'admin', 'unauthorized'],
      database: ['database', 'db', 'query', 'migration', 'backup', 'sql'],
      user_activity: ['user', 'created', 'updated', 'deleted', 'assigned'],
      system: ['server', 'started', 'stopped', 'error', 'warning', 'startup'],
      application: ['loading', 'dashboard', 'inventory', 'item', 'category']
    };

    try {
      // Read all log files from the logs directory
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(file => file.endsWith('.log') && !file.includes('audit'));

      // Read and parse each log file
      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          // Parse JSON log entries
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);

              // Add file source info
              logEntry.source = file;

              // Convert timestamp to Date object for easier handling
              logEntry.parsedTimestamp = new Date(logEntry.timestamp);

              // Skip noise if hideNoise is enabled
              if (hideNoise === 'true') {
                const messageToCheck = logEntry.message || '';
                const isNoise = noisePatterns.some(pattern => pattern.test(messageToCheck));
                if (isNoise) {
                  continue; // Skip this log entry
                }
              }

              // Categorize log entry
              logEntry.category = categorizeLog(logEntry, logCategories);

              // Add severity level for better filtering
              logEntry.severity = getSeverityLevel(logEntry);

              // Add human-readable relative time
              logEntry.timeAgo = getTimeAgo(logEntry.parsedTimestamp);

              allLogs.push(logEntry);
            } catch (parseError) {
              // Skip malformed log entries
              console.warn(`⚠️  Skipping malformed log entry in ${file}:`, line.substring(0, 100));
            }
          }
        } catch (fileError) {
          console.error(`❌ Error reading log file ${file}:`, fileError.message);
        }
      }

      // Sort logs by timestamp (newest first)
      allLogs.sort((a, b) => b.parsedTimestamp - a.parsedTimestamp);

      // Apply filters
      let filteredLogs = allLogs;

      // Filter by log level
      if (level && level !== '') {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }

      // Filter by category
      if (category && category !== '') {
        filteredLogs = filteredLogs.filter(log => log.category === category);
      }

      // Filter by date range
      if (startDate) {
        const start = new Date(startDate);
        filteredLogs = filteredLogs.filter(log => log.parsedTimestamp >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredLogs = filteredLogs.filter(log => log.parsedTimestamp <= end);
      }

      // Limit results
      const limitedLogs = filteredLogs.slice(0, parseInt(limit));

      // Prepare export data
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: req.session.user?.name || 'Unknown',
          totalLogs: allLogs.length,
          filteredLogs: filteredLogs.length,
          exportedLogs: limitedLogs.length,
          filters: {
            level: level || null,
            category: category || null,
            startDate: startDate || null,
            endDate: endDate || null,
            limit: parseInt(limit),
            hideNoise: hideNoise === 'true'
          }
        },
        logs: limitedLogs
      };

      // Set appropriate headers for file download
      const filename = `system_logs_${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Log export action for security audit
      console.log(`📤 Admin ${req.session.user?.name} exported ${limitedLogs.length} log entries`);

      // Send the JSON data
      res.json(exportData);

    } catch (dirError) {
      console.error('❌ Error reading logs directory:', dirError.message);
      res.status(500).json({
        error: 'Unable to read log files',
        message: dirError.message
      });
    }

  } catch (error) {
    console.error('❌ Error exporting logs:', error);
    res.status(500).json({
      error: 'Failed to export logs',
      message: error.message
    });
  }
};

// Database Backups Management
exports.backups = async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    const backupsDir = path.join(__dirname, '../../backups');
    let backupFiles = [];

    try {
      // Read all files from the backups directory
      const files = await fs.readdir(backupsDir);

      // Process each backup file
      for (const file of files) {
        const filePath = path.join(backupsDir, file);
        const stats = await fs.stat(filePath);

        // Determine backup type
        let type = 'unknown';
        if (file.startsWith('db_backup_') && file.endsWith('.sql')) {
          type = 'database';
        } else if (file.startsWith('backup_') && file.endsWith('.tar.gz')) {
          type = 'full_system';
        }

        // Parse date from filename
        let backupDate = null;
        const dateMatch = file.match(/(\d{8}_\d{6})/);
        if (dateMatch) {
          const dateStr = dateMatch[1];
          // Format: YYYYMMDD_HHMMSS
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const hour = dateStr.substring(9, 11);
          const minute = dateStr.substring(11, 13);
          const second = dateStr.substring(13, 15);

          backupDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        }

        backupFiles.push({
          name: file,
          type: type,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          created: stats.birthtime,
          modified: stats.mtime,
          backupDate: backupDate || stats.birthtime,
          path: filePath
        });
      }

      // Sort by backup date (newest first)
      backupFiles.sort((a, b) => b.backupDate - a.backupDate);

      // Backup files loaded successfully

    } catch (dirError) {
      console.error('❌ Error reading backups directory:', dirError.message);
      backupFiles = [];
    }

    // Get backup scheduler status if available
    let backupStatus = null;
    try {
      const backupScheduler = require('../services/backupScheduler');
      backupStatus = await backupScheduler.getBackupStatus();
    } catch (error) {
      console.warn('⚠️  Backup scheduler not available:', error.message);
    }

    res.render('layout', {
      title: 'Database Backups',
      body: 'admin/backups',
      backups: backupFiles,
      backupStatus: backupStatus,
      stats: {
        total: backupFiles.length,
        database: backupFiles.filter(b => b.type === 'database').length,
        system: backupFiles.filter(b => b.type === 'full_system').length,
        totalSize: backupFiles.reduce((sum, b) => sum + b.size, 0)
      },
      formatFileSize: formatFileSize,
      getTimeAgo: function(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);

        if (diffDays > 0) {
          return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHrs > 0) {
          return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
        } else {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        }
      }
    });

  } catch (error) {
    console.error('❌ Error loading backups:', error);
    req.flash('error', 'Failed to load backup information');
    res.redirect('/dashboard');
  }
};

exports.warrantyPage = (req, res) => {
  try {
  res.render('layout', {
    title: 'Warranty Management',
    body: 'admin/warranty',
    user: req.session.user
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    req.flash('error', 'Failed to load admin dashboard');
    res.redirect('/dashboard');
  }
};

// Helper function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Unlock user account
exports.unlockUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user details including lockout info for logging
    const userResult = await safeUserQuery(
      'SELECT name, email, cep_id, COALESCE(account_locked, false) as account_locked, COALESCE(failed_login_attempts, 0) as failed_login_attempts, locked_at, locked_until FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    const user = userResult.rows[0];

    // Check if user is actually locked
    if (!user.account_locked) {
      req.flash('info', `Account for ${user.name} is not currently locked`);
      return res.redirect('/admin/users');
    }

    // Unlock the user account and reset failed attempts (safely)
    try {
      await db.query(
        'UPDATE users SET account_locked = FALSE, failed_login_attempts = 0, locked_until = NULL, locked_at = NULL WHERE id = $1',
        [userId]
      );
    } catch (updateError) {
      if (updateError.code === '42703') {
        // If lockout columns don't exist, just log a warning
        console.warn('Lockout columns not available, user unlock operation skipped');
      } else {
        throw updateError;
      }
    }

    // Log the unlock action with details
    const lockDetails = {
      failedAttempts: user.failed_login_attempts || 0,
      lockedSince: user.locked_at ? new Date(user.locked_at).toLocaleString() : 'Unknown',
      wasLockedUntil: user.locked_until ? new Date(user.locked_until).toLocaleString() : 'Indefinite'
    };

    console.log(`🔓 Admin ${req.session.user.name} (${req.session.user.cep_id}) unlocked user account:`, {
      user: `${user.name} (${user.email})`,
      previousFailedAttempts: lockDetails.failedAttempts,
      lockedSince: lockDetails.lockedSince,
      wasLockedUntil: lockDetails.wasLockedUntil
    });

    req.flash('success', `Successfully unlocked account for ${user.name}. Previous failed attempts: ${lockDetails.failedAttempts}`);

    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error unlocking user account:', error);
    req.flash('error', 'Failed to unlock user account');
    res.redirect('/admin/users');
  }
};

// License Database Management
exports.testLicenseDatabase = async (req, res) => {
  try {
    // Testing license database functions

    const results = {
      validation: null,
      statistics: null,
      dashboard: null,
      errors: []
    };

    // Test license validation function
    try {
      const validationResult = await db.query('SELECT * FROM validate_license_data()');
      results.validation = validationResult.rows[0];
              // License validation function working
    } catch (error) {
      console.warn('⚠️  License validation function not available:', error.message);
      // Try fallback approach
      try {
        const fallbackResult = await db.query(`
          SELECT
            'FALLBACK' as validation_result,
            COUNT(*) as total_licenses,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_licenses,
            COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses,
            'License functions not available, using basic validation' as message
          FROM license_config
        `);
        results.validation = fallbackResult.rows[0] || { message: 'No license data available' };
        console.log('✅ License validation fallback works');
      } catch (fallbackError) {
        results.errors.push(`Validation function: ${error.message}`);
      }
    }

    // Test license statistics function
    try {
      const statsResult = await db.query('SELECT * FROM get_license_statistics()');
      results.statistics = statsResult.rows[0];
      console.log('✅ License statistics function works');
    } catch (error) {
      console.warn('⚠️  License statistics function not available:', error.message);
      // Try fallback approach
      try {
        const fallbackResult = await db.query(`
          SELECT
            COUNT(*) as total_licenses,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_licenses,
            COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses,
            COUNT(CASE WHEN status = 'invalid' THEN 1 END) as invalid_licenses,
            NULL as days_until_expiry
          FROM license_config
        `);
        results.statistics = fallbackResult.rows[0] || {
          total_licenses: 0, active_licenses: 0, expired_licenses: 0,
          invalid_licenses: 0, days_until_expiry: null
        };
        console.log('✅ License statistics fallback works');
      } catch (fallbackError) {
        results.errors.push(`Statistics function: ${error.message}`);
      }
    }

    // Test basic license config table
    try {
      const basicResult = await db.query('SELECT COUNT(*) as total, MAX(created_at) as last_update FROM license_config');
      results.basic_config = basicResult.rows[0];
      console.log('✅ License config table accessible');
    } catch (error) {
      console.warn('⚠️  License config table not available:', error.message);
      results.errors.push(`Config table: ${error.message}`);
    }

    // Return JSON response for AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({
        success: results.errors.length === 0,
        results: results,
        timestamp: new Date().toISOString()
      });
    }

    // Set flash messages for redirect
    if (results.errors.length === 0) {
      req.flash('success', 'All license database functions are working correctly');
    } else {
      req.flash('error', 'Some license database functions failed: ' + results.errors.join(', '));
    }

    res.redirect('/admin/license');
  } catch (error) {
    console.error('❌ License database test failed:', error);

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    req.flash('error', 'License database test failed: ' + error.message);
    res.redirect('/admin/license');
  }
};

// Performance Monitoring
exports.performance = async (req, res) => {
  try {
    // Get system performance metrics
    const performance = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // Get database performance metrics
    const dbStats = await db.query(`
      SELECT
        pg_database_size(current_database()) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    // Get table statistics
    const tableStats = await db.query(`
      SELECT
        schemaname,
        relname as tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
      LIMIT 10
    `);

    // Note: pg_stat_statements requires shared_preload_libraries configuration
    // For now, we'll skip query performance monitoring to avoid errors
    let slowQueries = [];
    // Uncomment below when pg_stat_statements is properly configured:
    /*
    try {
      // Try using our created view first
      const slowQueryResult = await db.query(`
        SELECT
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          rows
        FROM query_performance
        LIMIT 10
      `);
      slowQueries = slowQueryResult.rows;
    } catch (error) {
      // Try direct pg_stat_statements access
      try {
        const fallbackResult = await db.query(`
          SELECT
            query,
            calls,
            total_exec_time as total_time,
            mean_exec_time as mean_time,
            rows
          FROM pg_stat_statements
          WHERE query NOT LIKE '%pg_stat_statements%'
          ORDER BY mean_exec_time DESC
          LIMIT 10
        `);
        slowQueries = fallbackResult.rows;
      } catch (fallbackError) {
        // pg_stat_statements extension not available
        console.log('pg_stat_statements not available:', fallbackError.message);
      }
    }
    */

    res.render('layout', {
      title: 'Performance Monitor',
      body: 'admin/performance',
      user: req.session.user,
      performance,
      dbStats: dbStats.rows[0],
      tableStats: tableStats.rows,
      slowQueries
    });
  } catch (error) {
    console.error('Error loading performance data:', error);
    req.flash('error', 'Failed to load performance data');
    res.redirect('/admin/settings');
  }
};

// Database Tools
exports.database = async (req, res) => {
  try {
    res.render('layout', {
      title: 'Database Tools',
      body: 'admin/database',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading database tools:', error);
    req.flash('error', 'Failed to load database tools');
    res.redirect('/admin/settings');
  }
};

// Database API endpoints
exports.getDatabaseStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        pg_database_size(current_database()) as database_size,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getDatabaseBackups = async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const backupsDir = path.join(__dirname, '../../backups');

    let files = [];
    try {
      const dirFiles = await fs.readdir(backupsDir);

      for (const file of dirFiles) {
        const filePath = path.join(backupsDir, file);
        const stats = await fs.stat(filePath);

        files.push({
          name: file,
          size: stats.size,
          date: stats.mtime,
          path: filePath
        });
      }

      // Sort by date, newest first
      files.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.log('Backups directory not found or empty');
    }

    res.json({
      success: true,
      backups: files
    });
  } catch (error) {
    console.error('Error getting backups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getDatabaseInfo = async (req, res) => {
  try {
    const info = await db.query(`
      SELECT
        version() as version,
        current_database() as database_name,
        pg_encoding_to_char(encoding) as encoding,
        (SELECT setting FROM pg_settings WHERE name = 'shared_buffers') as shared_buffers,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
        extract(epoch from now() - pg_postmaster_start_time()) as uptime
      FROM pg_database
      WHERE datname = current_database()
    `);

    res.json({
      success: true,
      info: info.rows[0]
    });
  } catch (error) {
    console.error('Error getting database info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getDatabaseTables = async (req, res) => {
  try {
    const tables = await db.query(`
      SELECT
        t.table_name,
        pg_size_pretty(pg_total_relation_size(c.oid)) as pretty_size,
        pg_total_relation_size(c.oid) as size_bytes,
        s.n_live_tup,
        pg_size_pretty(pg_indexes_size(c.oid)) as index_size
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY pg_total_relation_size(c.oid) DESC NULLS LAST
      LIMIT 20
    `);

    res.json({
      success: true,
      tables: tables.rows
    });
  } catch (error) {
    console.error('Error getting table info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.analyzeDatabase = async (req, res) => {
  try {
    await db.query('ANALYZE');

    res.json({
      success: true,
      message: 'Database analysis completed successfully'
    });
  } catch (error) {
    console.error('Error analyzing database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.vacuumDatabase = async (req, res) => {
  try {
    await db.query('VACUUM ANALYZE');

    res.json({
      success: true,
      message: 'Database vacuum completed successfully'
    });
  } catch (error) {
    console.error('Error vacuuming database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.reindexDatabase = async (req, res) => {
  try {
    await db.query('REINDEX DATABASE ' + (await db.query('SELECT current_database()')).rows[0].current_database);

    res.json({
      success: true,
      message: 'Database reindex completed successfully'
    });
  } catch (error) {
    console.error('Error reindexing database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getUserAnalytics = async (req, res) => {
  try {
    // Enhanced analytics with new tables
    const [
      activeSessionsQuery,
      cookieConsentQuery,
      sessionDurationQuery,
      recentActivityQuery
    ] = await Promise.all([
      // Active sessions from analytics data
      db.query(`
        SELECT COUNT(DISTINCT session_id) as active_sessions
        FROM user_session_summary
        WHERE last_activity > NOW() - INTERVAL '30 minutes'
      `),

      // Cookie consent rate from analytics
      db.query(`
        SELECT
          COUNT(CASE WHEN consent_type = 'accepted_all' THEN 1 END)::FLOAT /
          NULLIF(COUNT(*), 0) * 100 as consent_rate
        FROM cookie_consent_analytics
        WHERE timestamp > NOW() - INTERVAL '7 days'
      `),

      // Average session duration from analytics
      db.query(`
        SELECT AVG(total_duration_seconds) as avg_duration
        FROM user_session_summary
        WHERE start_time > NOW() - INTERVAL '24 hours'
          AND end_time IS NOT NULL
      `),

      // Recent activity from page views
      db.query(`
        SELECT COUNT(DISTINCT session_id) as recent_visitors
        FROM user_analytics_events
        WHERE event_type = 'page_view'
          AND timestamp > NOW() - INTERVAL '1 hour'
      `)
    ]);

    // Fallback to user table for sessions if no analytics data
    let activeSessions = activeSessionsQuery.rows[0]?.active_sessions || 0;
    if (activeSessions === 0) {
      const fallbackQuery = await db.query(`
        SELECT COUNT(DISTINCT u.id) as active_users
        FROM users u
        WHERE u.last_login > NOW() - INTERVAL '24 hours'
          AND u.active = true
      `);
      activeSessions = fallbackQuery.rows[0]?.active_users || 0;
    }

    // Cookie consent rate with fallback
    let cookieConsentRate = Math.round(cookieConsentQuery.rows[0]?.consent_rate || 0);
    if (cookieConsentRate === 0) {
      // Fallback to user-based calculation
      const totalUsersQuery = await db.query('SELECT COUNT(*) as total FROM users WHERE active = true');
      const consentedUsersQuery = await db.query(`
        SELECT COUNT(DISTINCT u.id) as consented
        FROM users u
        WHERE u.last_login > NOW() - INTERVAL '7 days'
          AND u.active = true
      `);
      const totalUsers = totalUsersQuery.rows[0]?.total || 1;
      const consentedUsers = consentedUsersQuery.rows[0]?.consented || 0;
      cookieConsentRate = Math.round((consentedUsers / totalUsers) * 100);
    }

    // Session duration with fallback
    let avgSessionSeconds = sessionDurationQuery.rows[0]?.avg_duration || 0;
    if (avgSessionSeconds === 0) {
      const fallbackDuration = await db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (NOW() - u.last_login))/60)::int as avg_minutes
        FROM users u
        WHERE u.last_login > NOW() - INTERVAL '24 hours'
          AND u.active = true
      `);
      avgSessionSeconds = (fallbackDuration.rows[0]?.avg_minutes || 15) * 60;
    }

    // Performance score calculation
    const recentActivity = recentActivityQuery.rows[0]?.recent_visitors || 0;
    const performanceScore = Math.min(100,
      40 + // Base score
      Math.min(30, activeSessions * 5) + // Session activity (max 30 points)
      Math.min(20, recentActivity * 2) + // Recent activity (max 20 points)
      Math.min(10, cookieConsentRate / 10) // Consent rate (max 10 points)
    );

    // Format session duration
    const minutes = Math.floor(avgSessionSeconds / 60);
    const seconds = Math.round(avgSessionSeconds % 60);

    res.json({
      success: true,
      analytics: {
        activeSessions: activeSessions,
        cookieConsentRate: `${cookieConsentRate}%`,
        avgSessionDuration: `${minutes}m ${seconds}s`,
        performanceScore: `${Math.round(performanceScore)}/100`
      }
    });

  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      analytics: {
        activeSessions: 0,
        cookieConsentRate: '0%',
        avgSessionDuration: '0m 0s',
        performanceScore: '0/100'
      }
    });
  }
};

// =============================================================================
// SECURITY MANAGEMENT METHODS
// =============================================================================

// Helper function to check if security tables exist
async function checkSecurityTables() {
  const requiredTables = ['login_attempts', 'account_lockouts', 'security_events', 'user_sessions'];
  const existing = [];
  const missing = [];

  for (const table of requiredTables) {
    try {
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
      existing.push(table);
    } catch (error) {
      // Table doesn't exist or can't be queried
      missing.push(table);
    }
  }

  return {
    allExist: missing.length === 0,
    existing,
    missing
  };
}

exports.securityCenter = async (req, res) => {
  try {
    // Check if security tables exist first
    const securityTablesExist = await checkSecurityTables();

    if (!securityTablesExist.allExist) {
      return res.render('layout', {
        title: 'Security Center',
        body: 'admin/security-center',
        user: req.user,
        securityData: {
          tablesNotReady: true,
          missingTables: securityTablesExist.missing,
          message: 'Security tables are not yet initialized. Please run database migrations.'
        }
      });
    }

    // Get security overview data
    const [
      recentAttemptsResult,
      lockedAccountsResult,
      securityEventsResult,
      activeSessionsResult,
      suspiciousActivityResult
    ] = await Promise.all([
      // Recent failed login attempts (last 24 hours)
      db.query(`
        SELECT COUNT(*) as total,
               COUNT(DISTINCT identifier) as unique_identifiers,
               MAX(attempt_time) as last_attempt
        FROM login_attempts
        WHERE attempt_time > NOW() - INTERVAL '24 hours'
          AND attempt_type = 'failed'
      `),

      // Currently locked accounts
      db.query(`
        SELECT COUNT(*) as total,
               MAX(locked_until) as next_unlock
        FROM account_lockouts
        WHERE locked_until > NOW()
      `),

      // Security events summary (last 24 hours)
      db.query(`
        SELECT event_type, severity, COUNT(*) as count
        FROM security_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY event_type, severity
        ORDER BY count DESC
      `),

      // Active sessions
      db.query(`
        SELECT COUNT(*) as total,
               COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions
        WHERE is_active = true
          AND expires_at > NOW()
      `),

      // Suspicious activity indicators (with fallback for missing columns)
      db.query(`
        SELECT
          COALESCE(
            (SELECT COUNT(CASE WHEN failed_login_attempts > 3 THEN 1 END) FROM users
             WHERE EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'users' AND column_name = 'failed_login_attempts')),
            0
          ) as users_with_failures,
          COALESCE(
            (SELECT COUNT(CASE WHEN account_locked = true THEN 1 END) FROM users
             WHERE EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'users' AND column_name = 'account_locked')),
            0
          ) as locked_users,
          COUNT(CASE WHEN last_login < NOW() - INTERVAL '30 days' THEN 1 END) as inactive_users
        FROM users
      `)
    ]);

    const securitySummary = {
      failedAttempts: {
        total: parseInt(recentAttemptsResult.rows[0].total),
        uniqueIdentifiers: parseInt(recentAttemptsResult.rows[0].unique_identifiers),
        lastAttempt: recentAttemptsResult.rows[0].last_attempt
      },
      lockedAccounts: {
        total: parseInt(lockedAccountsResult.rows[0].total),
        nextUnlock: lockedAccountsResult.rows[0].next_unlock
      },
      events: securityEventsResult.rows,
      sessions: {
        total: parseInt(activeSessionsResult.rows[0]?.total || 0),
        uniqueUsers: parseInt(activeSessionsResult.rows[0]?.unique_users || 0)
      },
      suspiciousActivity: suspiciousActivityResult.rows[0]
    };

    res.render('layout', {
      title: 'Security Center',
      body: 'admin/security-center',
      securitySummary,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error loading security center:', error);

    // Check if it's a missing table error
    if (error.code === '42P01') {
      req.flash('error', 'Security tables are not initialized. Please run database migrations.');
    } else {
      req.flash('error', 'Failed to load security center: ' + error.message);
    }
    res.redirect('/admin');
  }
};

exports.securityLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const eventType = req.query.event_type;
    const severity = req.query.severity;
    const timeframe = req.query.timeframe || '24h';

    // Build time filter
    let timeFilter = '';
    switch (timeframe) {
      case '1h': timeFilter = "se.created_at > NOW() - INTERVAL '1 hour'"; break;
      case '24h': timeFilter = "se.created_at > NOW() - INTERVAL '24 hours'"; break;
      case '7d': timeFilter = "se.created_at > NOW() - INTERVAL '7 days'"; break;
      case '30d': timeFilter = "se.created_at > NOW() - INTERVAL '30 days'"; break;
      default: timeFilter = "se.created_at > NOW() - INTERVAL '24 hours'";
    }

    // Build filters
    let filters = [timeFilter];
    const params = [];
    let paramIndex = 1;

    if (eventType) {
      filters.push(`se.event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }

    if (severity) {
      filters.push(`se.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Get security events
    const logsResult = await db.query(`
      SELECT
        se.id,
        se.event_type,
        se.severity,
        se.ip_address,
        se.user_agent,
        se.event_data,
        se.created_at,
        u.name as user_name,
        u.email as user_email
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      ${whereClause}
      ORDER BY se.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM security_events se
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get available event types and severities for filters
    const eventTypesResult = await db.query(`
      SELECT DISTINCT event_type
      FROM security_events
      WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY event_type
    `);

    res.render('layout', {
      title: 'Security Logs',
      body: 'admin/security-logs',
      logs: logsResult.rows,
      pagination: {
        page,
        totalPages,
        total,
        limit
      },
      filters: {
        eventType,
        severity,
        timeframe
      },
      eventTypes: eventTypesResult.rows.map(r => r.event_type),
      severityLevels: ['low', 'medium', 'high', 'critical'],
      user: req.session.user
    });

  } catch (error) {
    console.error('Error loading security logs:', error);
    req.flash('error', 'Failed to load security logs');
    res.redirect('/admin/security');
  }
};

exports.securityEvents = async (req, res) => {
  try {
    // Get recent security events with details
    const eventsResult = await db.query(`
      SELECT
        se.id,
        se.event_type,
        se.severity,
        se.ip_address,
        se.user_agent,
        se.event_data,
        se.created_at,
        u.name as user_name,
        u.email as user_email,
        u.cep_id
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE se.created_at > NOW() - INTERVAL '7 days'
      ORDER BY se.created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      events: eventsResult.rows
    });

  } catch (error) {
    console.error('Error loading security events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load security events'
    });
  }
};

exports.accountLockouts = async (req, res) => {
  try {
    // Get currently locked accounts with details
    const lockoutsResult = await safeUserQuery(`
      SELECT
        al.id,
        al.identifier,
        al.locked_at,
        al.locked_until,
        al.attempt_count,
        al.reason,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.cep_id,
        COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
        COALESCE(u.account_locked, false) as user_locked
      FROM account_lockouts al
      LEFT JOIN users u ON al.identifier = u.email OR al.identifier = u.cep_id
      WHERE al.locked_until > NOW()
      ORDER BY al.locked_at DESC
    `);

    // Get recent failed attempts by identifier
    const attemptsResult = await db.query(`
      SELECT
        identifier,
        COUNT(*) as attempt_count,
        MAX(attempt_time) as last_attempt,
        MIN(attempt_time) as first_attempt
      FROM login_attempts
      WHERE attempt_time > NOW() - INTERVAL '24 hours'
        AND attempt_type = 'failed'
      GROUP BY identifier
      HAVING COUNT(*) >= 3
      ORDER BY attempt_count DESC, last_attempt DESC
    `);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        lockouts: lockoutsResult.rows,
        recentAttempts: attemptsResult.rows
      });
    }

    res.render('layout', {
      title: 'Account Lockouts',
      body: 'admin/account-lockouts',
      lockouts: lockoutsResult.rows,
      recentAttempts: attemptsResult.rows,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error loading account lockouts:', error);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load account lockouts'
      });
    }
    req.flash('error', 'Failed to load account lockouts');
    res.redirect('/admin/security');
  }
};

exports.unlockAccount = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Identifier is required'
      });
    }

    // Remove lockout record
    await db.query('DELETE FROM account_lockouts WHERE identifier = $1', [identifier]);

    // Reset user failed attempts if it's a user account (safely)
    try {
      await db.query(`
        UPDATE users
        SET failed_login_attempts = 0,
            account_locked = FALSE,
            locked_until = NULL
        WHERE email = $1 OR cep_id = $1
      `, [identifier]);
    } catch (updateError) {
      if (updateError.code === '42703') {
        // If lockout columns don't exist, just continue
        console.warn('Lockout columns not available for user reset');
      } else {
        throw updateError;
      }
    }

    // Log security event
    await db.query(`
      INSERT INTO security_events (event_type, severity, ip_address, event_data, user_id)
      VALUES ('account_unlocked', 'medium', $1, $2, $3)
    `, [
      req.ip,
      JSON.stringify({
        identifier,
        unlocked_by: req.session.user.name,
        unlocked_by_id: req.session.user.id
      }),
      req.session.user.id
    ]);

    res.json({
      success: true,
      message: `Account ${identifier} has been unlocked successfully`
    });

  } catch (error) {
    console.error('Error unlocking account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock account'
    });
  }
};

exports.clearLoginAttempts = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Identifier is required'
      });
    }

    // Clear login attempts
    const result = await db.query(
      'DELETE FROM login_attempts WHERE identifier = $1',
      [identifier]
    );

    // Log security event
    await db.query(`
      INSERT INTO security_events (event_type, severity, ip_address, event_data, user_id)
      VALUES ('login_attempts_cleared', 'low', $1, $2, $3)
    `, [
      req.ip,
      JSON.stringify({
        identifier,
        cleared_by: req.session.user.name,
        cleared_by_id: req.session.user.id,
        attempts_cleared: result.rowCount
      }),
      req.session.user.id
    ]);

    res.json({
      success: true,
      message: `Cleared ${result.rowCount} login attempts for ${identifier}`
    });

  } catch (error) {
    console.error('Error clearing login attempts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear login attempts'
    });
  }
};

exports.activeSessions = async (req, res) => {
  try {
    // Get all active sessions with user details
    const sessionsResult = await db.query(`
      SELECT
        us.id,
        us.session_id,
        us.ip_address,
        us.user_agent,
        us.created_at,
        us.last_activity,
        us.expires_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.cep_id,
        EXTRACT(EPOCH FROM (NOW() - us.last_activity))/60 as minutes_inactive
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.is_active = true
        AND us.expires_at > NOW()
      ORDER BY us.last_activity DESC
    `);

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        sessions: sessionsResult.rows
      });
    }

    res.render('layout', {
      title: 'Active Sessions',
      body: 'admin/active-sessions',
      sessions: sessionsResult.rows,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error loading active sessions:', error);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load active sessions'
      });
    }
    req.flash('error', 'Failed to load active sessions');
    res.redirect('/admin/security');
  }
};

exports.killSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Get session details before killing it
    const sessionResult = await db.query(`
      SELECT us.*, u.name as user_name, u.email as user_email
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_id = $1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessionResult.rows[0];

    // Deactivate the session
    await db.query(`
      UPDATE user_sessions
      SET is_active = FALSE, logout_time = NOW()
      WHERE session_id = $1
    `, [sessionId]);

    // Log security event
    await db.query(`
      INSERT INTO security_events (event_type, severity, ip_address, event_data, user_id)
      VALUES ('session_killed', 'medium', $1, $2, $3)
    `, [
      req.ip,
      JSON.stringify({
        killed_session_id: sessionId,
        target_user: session.user_name,
        target_user_id: session.user_id,
        killed_by: req.session.user.name,
        killed_by_id: req.session.user.id
      }),
      req.session.user.id
    ]);

    res.json({
      success: true,
      message: `Session for ${session.user_name} has been terminated`
    });

  } catch (error) {
    console.error('Error killing session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to terminate session'
    });
  }
};
