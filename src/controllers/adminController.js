// src/controllers/adminController.js
const db = require('../config/db');
const bcrypt = require('bcrypt');

// User Management
exports.users = async (req, res) => {
  try {
    // Fetch all users with their roles
    const usersResult = await db.query(`
      SELECT u.id, u.name, u.email, u.role,
             COALESCE(u.active, true) as active,
             u.last_login, u.created_at,
             ARRAY_AGG(r.display_name ORDER BY r.display_name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id, u.name, u.email, u.role, u.active, u.last_login, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.render('layout', {
      title: 'User Management',
      body: 'admin/users',
      users: usersResult.rows,
      currentUser: req.session.user,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load users',
      user: req.session.user
    });
  }
};

exports.showAddUserForm = async (req, res) => {
  try {
    // Fetch all available roles
    const rolesResult = await db.query(`
      SELECT id, name, display_name, description
      FROM roles
      ORDER BY display_name
    `);

    res.render('layout', {
      title: 'Add User',
      body: 'admin/add-user',
      user: req.session.user,
      roles: rolesResult.rows,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error loading roles:', error);
    res.render('layout', {
      title: 'Add User',
      body: 'admin/add-user',
      user: req.session.user,
      roles: [],
      isAdminPage: true
    });
  }
};

exports.addUser = async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { name, email, password, selectedRoles } = req.body;

    // Validate input
    if (!name || !email || !password) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/users/add');
    }

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      req.flash('error', 'Email already exists');
      return res.redirect('/admin/users/add');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user
    const userResult = await client.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [name, email, hashedPassword, 'user']); // Default role column to 'user'

    const userId = userResult.rows[0].id;

    // Assign roles if selected
    if (selectedRoles && selectedRoles.length > 0) {
      const roleIds = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles];

      for (const roleId of roleIds) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ($1, $2, $3)
        `, [userId, roleId, req.session.user.id]);
      }
    } else {
      // Assign default 'user' role if no roles selected
      const defaultRole = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['user']
      );

      if (defaultRole.rows.length > 0) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ($1, $2, $3)
        `, [userId, defaultRole.rows[0].id, req.session.user.id]);
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'User created successfully');
    res.redirect('/admin/users');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error);
    req.flash('error', 'Failed to create user');
    res.redirect('/admin/users/add');
  } finally {
    client.release();
  }
};

exports.showEditUserForm = async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch user data
    const userResult = await db.query(`
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Fetch all available roles
    const rolesResult = await db.query(`
      SELECT id, name, display_name, description
      FROM roles
      ORDER BY display_name
    `);

    // Fetch user's current roles
    const userRolesResult = await db.query(`
      SELECT role_id
      FROM user_roles
      WHERE user_id = $1
    `, [userId]);

    const userRoleIds = userRolesResult.rows.map(row => row.role_id);

    res.render('layout', {
      title: 'Edit User',
      body: 'admin/edit-user',
      user: req.session.user,
      editUser: userResult.rows[0],
      roles: rolesResult.rows,
      userRoleIds: userRoleIds,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    req.flash('error', 'Could not fetch user data');
    res.redirect('/admin/users');
  }
};

exports.editUser = async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const userId = req.params.id;
    const { name, email, password, selectedRoles } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      req.flash('error', 'Name is required and cannot be empty');
      return res.redirect(`/admin/users/${userId}/edit`);
    }

    if (!email || email.trim() === '') {
      req.flash('error', 'Email is required and cannot be empty');
      return res.redirect(`/admin/users/${userId}/edit`);
    }

    // Trim whitespace from inputs
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Check if email already exists for other users
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [trimmedEmail, userId]
    );

    if (existingUser.rows.length > 0) {
      req.flash('error', 'Email already exists');
      return res.redirect(`/admin/users/${userId}/edit`);
    }

    if (password && password.trim() !== '') {
      // Update with new password
      const hashedPassword = await bcrypt.hash(password, 10);
      await client.query(`
        UPDATE users
        SET name = $1, email = $2, password = $3, updated_at = NOW()
        WHERE id = $4
      `, [trimmedName, trimmedEmail, hashedPassword, userId]);
    } else {
      // Update without changing password
      await client.query(`
        UPDATE users
        SET name = $1, email = $2, updated_at = NOW()
        WHERE id = $3
      `, [trimmedName, trimmedEmail, userId]);
    }

    // Update user roles
    // First, remove all existing roles
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    // Then add the selected roles
    if (selectedRoles && selectedRoles.length > 0) {
      const roleIds = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles];

      for (const roleId of roleIds) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ($1, $2, $3)
        `, [userId, roleId, req.session.user.id]);
      }
    } else {
      // Assign default 'user' role if no roles selected
      const defaultRole = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['user']
      );

      if (defaultRole.rows.length > 0) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ($1, $2, $3)
        `, [userId, defaultRole.rows[0].id, req.session.user.id]);
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', error);
    req.flash('error', 'Failed to update user');
    res.redirect(`/admin/users/${req.params.id}/edit`);
  } finally {
    client.release();
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow deleting yourself
    if (userId == req.session.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/admin/users');
    }

    // Check if user has super_admin role (protect system users)
    const userRoles = await db.query(`
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND r.name = 'super_admin'
    `, [userId]);

    if (userRoles.rows.length > 0) {
      req.flash('error', 'Cannot delete super administrator users');
      return res.redirect('/admin/users');
    }

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    req.flash('success', 'User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    req.flash('error', 'Failed to delete user');
    res.redirect('/admin/users');
  }
};

// Role Management
exports.roles = async (req, res) => {
  try {
    const rolesResult = await db.query(`
      SELECT r.id, r.name, r.display_name, r.description, r.is_system_role,
             r.created_at, r.updated_at,
             COUNT(ur.user_id) as user_count,
             COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.display_name, r.description, r.is_system_role, r.created_at, r.updated_at
      ORDER BY r.display_name
    `);

    res.render('layout', {
      title: 'Role Management',
      body: 'admin/roles',
      roles: rolesResult.rows,
      user: req.session.user,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error loading roles:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load roles',
      user: req.session.user
    });
  }
};

exports.showAddRoleForm = async (req, res) => {
  try {
    // Fetch all permissions grouped by module
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
      title: 'Add Role',
      body: 'admin/add-role',
      user: req.session.user,
      permissionsByModule: permissionsByModule,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error loading permissions:', error);
    res.render('layout', {
      title: 'Add Role',
      body: 'admin/add-role',
      user: req.session.user,
      permissionsByModule: {},
      isAdminPage: true
    });
  }
};

exports.addRole = async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { name, display_name, description, selectedPermissions } = req.body;

    // Validate input
    if (!name || !display_name) {
      req.flash('error', 'Name and display name are required');
      return res.redirect('/admin/roles/add');
    }

    // Check if role name already exists
    const existingRole = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      [name]
    );

    if (existingRole.rows.length > 0) {
      req.flash('error', 'Role name already exists');
      return res.redirect('/admin/roles/add');
    }

    // Insert the new role
    const roleResult = await client.query(`
      INSERT INTO roles (name, display_name, description, is_system_role)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [name, display_name, description || null, false]);

    const roleId = roleResult.rows[0].id;

    // Assign permissions if selected
    if (selectedPermissions && selectedPermissions.length > 0) {
      const permissionIds = Array.isArray(selectedPermissions) ? selectedPermissions : [selectedPermissions];

      for (const permissionId of permissionIds) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `, [roleId, permissionId]);
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'Role created successfully');
    res.redirect('/admin/roles');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating role:', error);
    req.flash('error', 'Failed to create role');
    res.redirect('/admin/roles/add');
  } finally {
    client.release();
  }
};

exports.showEditRoleForm = async (req, res) => {
  try {
    const roleId = req.params.id;

    // Fetch role data
    const roleResult = await db.query(`
      SELECT id, name, display_name, description, is_system_role
      FROM roles
      WHERE id = $1
    `, [roleId]);

    if (roleResult.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    // Fetch all permissions grouped by module
    const permissionsResult = await db.query(`
      SELECT id, name, display_name, description, module
      FROM permissions
      ORDER BY module, display_name
    `);

    // Fetch role's current permissions
    const rolePermissionsResult = await db.query(`
      SELECT permission_id
      FROM role_permissions
      WHERE role_id = $1
    `, [roleId]);

    const rolePermissionIds = rolePermissionsResult.rows.map(row => row.permission_id);

    // Group permissions by module
    const permissionsByModule = {};
    permissionsResult.rows.forEach(permission => {
      if (!permissionsByModule[permission.module]) {
        permissionsByModule[permission.module] = [];
      }
      permissionsByModule[permission.module].push(permission);
    });

    res.render('layout', {
      title: 'Edit Role',
      body: 'admin/edit-role',
      user: req.session.user,
      editRole: roleResult.rows[0],
      permissionsByModule: permissionsByModule,
      rolePermissionIds: rolePermissionIds,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    req.flash('error', 'Could not fetch role data');
    res.redirect('/admin/roles');
  }
};

exports.editRole = async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const roleId = req.params.id;
    const { name, display_name, description, selectedPermissions } = req.body;

    // Check if role is system role and prevent editing critical properties
    const roleCheck = await client.query(
      'SELECT is_system_role FROM roles WHERE id = $1',
      [roleId]
    );

    if (roleCheck.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    const isSystemRole = roleCheck.rows[0].is_system_role;

    // Validate required fields
    if (!display_name || display_name.trim() === '') {
      req.flash('error', 'Display name is required');
      return res.redirect(`/admin/roles/${roleId}/edit`);
    }

    // For system roles, only allow editing display name, description, and permissions
    if (isSystemRole) {
      await client.query(`
        UPDATE roles
        SET display_name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
      `, [display_name.trim(), description || null, roleId]);
    } else {
      // For non-system roles, allow editing name as well
      if (!name || name.trim() === '') {
        req.flash('error', 'Name is required');
        return res.redirect(`/admin/roles/${roleId}/edit`);
      }

      // Check if role name already exists for other roles
      const existingRole = await client.query(
        'SELECT id FROM roles WHERE name = $1 AND id != $2',
        [name, roleId]
      );

      if (existingRole.rows.length > 0) {
        req.flash('error', 'Role name already exists');
        return res.redirect(`/admin/roles/${roleId}/edit`);
      }

      await client.query(`
        UPDATE roles
        SET name = $1, display_name = $2, description = $3, updated_at = NOW()
        WHERE id = $4
      `, [name.trim(), display_name.trim(), description || null, roleId]);
    }

    // Update role permissions
    // First, remove all existing permissions
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Then add the selected permissions
    if (selectedPermissions && selectedPermissions.length > 0) {
      const permissionIds = Array.isArray(selectedPermissions) ? selectedPermissions : [selectedPermissions];

      for (const permissionId of permissionIds) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `, [roleId, permissionId]);
      }
    }

    await client.query('COMMIT');
    req.flash('success', 'Role updated successfully');
    res.redirect('/admin/roles');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating role:', error);
    req.flash('error', 'Failed to update role');
    res.redirect(`/admin/roles/${req.params.id}/edit`);
  } finally {
    client.release();
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    // Check if role exists and is not a system role
    const roleResult = await db.query(`
      SELECT name, is_system_role
      FROM roles
      WHERE id = $1
    `, [roleId]);

    if (roleResult.rows.length === 0) {
      req.flash('error', 'Role not found');
      return res.redirect('/admin/roles');
    }

    const role = roleResult.rows[0];

    if (role.is_system_role) {
      req.flash('error', 'Cannot delete system roles');
      return res.redirect('/admin/roles');
    }

    // Check if role is assigned to any users
    const userCount = await db.query(`
      SELECT COUNT(*) as count
      FROM user_roles
      WHERE role_id = $1
    `, [roleId]);

    if (parseInt(userCount.rows[0].count) > 0) {
      req.flash('error', 'Cannot delete role that is assigned to users');
      return res.redirect('/admin/roles');
    }

    await db.query(`DELETE FROM roles WHERE id = $1`, [roleId]);

    req.flash('success', 'Role deleted successfully');
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
    const permissionsResult = await db.query(`
      SELECT p.id, p.name, p.display_name, p.description, p.module,
             p.created_at, p.updated_at,
             COUNT(rp.role_id) as role_count
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      GROUP BY p.id, p.name, p.display_name, p.description, p.module, p.created_at, p.updated_at
      ORDER BY p.module, p.display_name
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
      title: 'Permission Management',
      body: 'admin/permissions',
      permissionsByModule: permissionsByModule,
      user: req.session.user,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error loading permissions:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load permissions',
      user: req.session.user
    });
  }
};

// System Settings (existing code with minor updates)
exports.settings = async (req, res) => {
  try {
    const settingsResult = await db.query(`
      SELECT setting_key, setting_value, description
      FROM system_settings
    `);

    // Convert to object for easier template access
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.render('layout', {
      title: 'System Settings',
      body: 'admin/settings',
      user: req.session.user,
      settings: settings,
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch system settings',
      user: req.session.user
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { company_name, items_per_page, enable_notifications, default_language } = req.body;

    const settings = [
      { key: 'company_name', value: company_name, description: 'Company name displayed throughout the application' },
      { key: 'items_per_page', value: items_per_page, description: 'Number of items to display per page in listings' },
      { key: 'enable_notifications', value: enable_notifications === 'on' ? 'true' : 'false', description: 'Whether to enable system notifications' },
      { key: 'default_language', value: default_language, description: 'Default language for the application' }
    ];

    for (const setting of settings) {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = $2, description = $3, updated_at = NOW()
      `, [setting.key, setting.value, setting.description]);
    }

    req.flash('success', 'System settings updated successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    req.flash('error', 'Failed to update system settings');
    res.redirect('/admin/settings');
  }
};

// Activity Logs (existing code)
exports.logs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countResult = await db.query(`SELECT COUNT(*) as total FROM activity_logs`);
    const totalLogs = parseInt(countResult.rows[0].total);

    // Get logs with pagination
    const logs = await db.query(`
      SELECT l.*, u.name as user_name
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.render('layout', {
      title: 'Activity Logs',
      body: 'admin/logs',
      user: req.session.user,
      logs: logs.rows,
      pagination: {
        current: page,
        total: Math.ceil(totalLogs / limit),
        limit: limit
      },
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch activity logs',
      user: req.session.user
    });
  }
};
