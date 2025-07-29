// src/controllers/adminController.js
const db = require('../config/db');
const bcrypt = require('bcrypt');

// Users Management
exports.users = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.created_at, u.last_login,
        CASE WHEN u.active IS NULL THEN true ELSE u.active END as active,
        array_agg(DISTINCT r.display_name ORDER BY r.display_name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id, u.name, u.email, u.role, u.created_at, u.last_login, u.active
      ORDER BY u.created_at DESC
    `);

    res.render('layout', {
      title: 'User Management',
      body: 'admin/users',
      users: result.rows,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/dashboard');
  }
};

exports.showAddUserForm = async (req, res) => {
  try {
    const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');

    res.render('layout', {
      title: 'Add New User',
      body: 'admin/add-user',
      roles: rolesResult.rows,
      formData: {}
    });
  } catch (error) {
    console.error('Error loading add user form:', error);
    req.flash('error', 'Failed to load user form');
    res.redirect('/admin/users');
  }
};

exports.addUser = async (req, res) => {
  try {
    const { name, email, password, confirm_password, selectedRoles } = req.body;
    const errors = [];

    // Validation
    if (!name || name.trim() === '') errors.push('Name is required');
    if (!email || email.trim() === '') errors.push('Email is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirm_password) errors.push('Passwords do not match');

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      errors.push('Email already exists');
    }

    if (errors.length > 0) {
      const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
      return res.render('layout', {
        title: 'Add New User',
        body: 'admin/add-user',
        roles: rolesResult.rows,
        errors,
        formData: { name, email }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await db.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
      [name.trim(), email.trim(), hashedPassword, 'user'] // Default role for compatibility
    );

    const userId = userResult.rows[0].id;

    // Assign roles
    const rolesToAssign = Array.isArray(selectedRoles) ? selectedRoles : (selectedRoles ? [selectedRoles] : ['user']);

    for (const roleId of rolesToAssign) {
      await db.query(
        'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
        [userId, roleId, req.session.user.id]
      );
    }

    req.flash('success', `User ${name} created successfully`);
    res.redirect('/admin/users');

  } catch (error) {
    console.error('Error creating user:', error);

    const rolesResult = await db.query('SELECT * FROM roles ORDER BY display_name');
    res.render('layout', {
      title: 'Add New User',
      body: 'admin/add-user',
      roles: rolesResult.rows,
      errors: ['Failed to create user'],
      formData: req.body
    });
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
      userRoleIds
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
    const { name, email, password, confirm_password, selectedRoles } = req.body;
    const errors = [];

    // Validation
    if (!name || name.trim() === '') errors.push('Name is required');
    if (!email || email.trim() === '') errors.push('Email is required');

    if (password) {
      if (password.length < 6) errors.push('Password must be at least 6 characters');
      if (password !== confirm_password) errors.push('Passwords do not match');
    }

    // Check if email already exists for other users
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (existingUser.rows.length > 0) {
      errors.push('Email already exists');
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
    let updateQuery = 'UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3';
    let updateParams = [name.trim(), email.trim(), userId];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = 'UPDATE users SET name = $1, email = $2, password = $4, updated_at = NOW() WHERE id = $3';
      updateParams = [name.trim(), email.trim(), userId, hashedPassword];
    }

    await db.query(updateQuery, updateParams);

    // Update roles if user has permission
    if (req.session.user.permissions && req.session.user.permissions.includes('users.manage_roles')) {
      // Remove existing roles
      await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // Add new roles
      const rolesToAssign = Array.isArray(selectedRoles) ? selectedRoles : (selectedRoles ? [selectedRoles] : []);

      for (const roleId of rolesToAssign) {
        await db.query(
          'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
          [userId, roleId, req.session.user.id]
        );
      }
    }

    req.flash('success', `User ${name} updated successfully`);
    res.redirect('/admin/users');

  } catch (error) {
    console.error('Error updating user:', error);
    req.flash('error', 'Failed to update user');
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
      formData: {}
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
    const permissionsToAssign = Array.isArray(selectedPermissions) ? selectedPermissions : (selectedPermissions ? [selectedPermissions] : []);

    for (const permissionId of permissionsToAssign) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, permissionId]
      );
    }

    req.flash('success', `Role ${display_name} created successfully`);
    res.redirect('/admin/roles');

  } catch (error) {
    console.error('Error creating role:', error);
    req.flash('error', 'Failed to create role');
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
      rolePermissionIds
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

    const permissionsToAssign = Array.isArray(selectedPermissions) ? selectedPermissions : (selectedPermissions ? [selectedPermissions] : []);

    for (const permissionId of permissionsToAssign) {
      await db.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
        [roleId, permissionId]
      );
    }

    req.flash('success', `Role ${display_name} updated successfully`);
    res.redirect('/admin/roles');

  } catch (error) {
    console.error('Error updating role:', error);
    req.flash('error', 'Failed to update role');
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
    // For now, return empty logs - you can implement actual logging later
    const logs = [];

    res.render('layout', {
      title: 'Activity Logs',
      body: 'admin/logs',
      logs
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    req.flash('error', 'Failed to load logs');
    res.redirect('/dashboard');
  }
};
