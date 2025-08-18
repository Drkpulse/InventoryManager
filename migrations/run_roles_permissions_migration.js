// migrations/run_roles_permissions_migration.js
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Starting roles and permissions migration...');

    // Execute migration statements directly instead of reading from file
    await executeDirectMigration();

    // Add developer role if it doesn't exist
    console.log('Adding developer role...');
    try {
      await db.query(`
        INSERT INTO roles (name, display_name, description, is_system_role)
        VALUES ('developer', 'Developer', 'Developer access with full system permissions', true)
        ON CONFLICT (name) DO NOTHING
      `);

      // Assign all permissions to developer role
      await db.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT
          (SELECT id FROM roles WHERE name = 'developer'),
          p.id
        FROM permissions p
        WHERE NOT EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'developer')
          AND rp.permission_id = p.id
        )
      `);

      console.log('Developer role added successfully!');
    } catch (error) {
      console.log('Developer role already exists or error occurred:', error.message);
    }

    // Verify the migration
    console.log('\nVerifying migration...');

    const roleCount = await db.query('SELECT COUNT(*) as count FROM roles');
    console.log(`✓ Roles table: ${roleCount.rows[0].count} roles`);

    const permissionCount = await db.query('SELECT COUNT(*) as count FROM permissions');
    console.log(`✓ Permissions table: ${permissionCount.rows[0].count} permissions`);

    const userRoleCount = await db.query('SELECT COUNT(*) as count FROM user_roles');
    console.log(`✓ User roles assignments: ${userRoleCount.rows[0].count} assignments`);

    const rolePermissionCount = await db.query('SELECT COUNT(*) as count FROM role_permissions');
    console.log(`✓ Role permissions assignments: ${rolePermissionCount.rows[0].count} assignments`);

    // Test user permissions function
    console.log('\nTesting user permissions...');
    const testUsers = await db.query('SELECT id, name FROM users LIMIT 3');
    for (const user of testUsers.rows) {
      try {
        const permissions = await db.query('SELECT * FROM get_user_permissions($1)', [user.id]);
        const roles = await db.query('SELECT * FROM get_user_roles($1)', [user.id]);
        console.log(`User ${user.name}: ${roles.rows.length} roles, ${permissions.rows.length} permissions`);
      } catch (error) {
        console.log(`Error testing permissions for user ${user.name}:`, error.message);
      }
    }

    console.log('\nMigration verification completed!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function executeDirectMigration() {
  console.log('Creating tables and functions...');

  // Create permissions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      module VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create roles table
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_system_role BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create role_permissions junction table
  await db.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role_id, permission_id)
    )
  `);

  // Create user_roles junction table
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role_id)
    )
  `);

  // Add indexes
  console.log('Creating indexes...');
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module)',
    'CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)'
  ];

  for (const indexSql of indexes) {
    try {
      await db.query(indexSql);
    } catch (error) {
      console.log('Index already exists:', error.message);
    }
  }

  // Insert permissions
  console.log('Inserting permissions...');
  const permissions = [
    // User Management
    ['users.view', 'View Users', 'Can view user list and details', 'users'],
    ['users.create', 'Create Users', 'Can create new users', 'users'],
    ['users.edit', 'Edit Users', 'Can edit user information', 'users'],
    ['users.delete', 'Delete Users', 'Can delete users', 'users'],
    ['users.manage_roles', 'Manage User Roles', 'Can assign/remove roles from users', 'users'],
    ['users.reset_password', 'Reset User Password', 'Can reset user passwords', 'users'],
    ['users.activate', 'Activate/Deactivate Users', 'Can activate or deactivate user accounts', 'users'],

    // Role Management
    ['roles.view', 'View Roles', 'Can view roles and permissions', 'roles'],
    ['roles.create', 'Create Roles', 'Can create new roles', 'roles'],
    ['roles.edit', 'Edit Roles', 'Can edit roles and their permissions', 'roles'],
    ['roles.delete', 'Delete Roles', 'Can delete non-system roles', 'roles'],
    ['roles.assign', 'Assign Roles', 'Can assign roles to users', 'roles'],

    // Item Management
    ['items.view', 'View Items', 'Can view inventory items', 'items'],
    ['items.create', 'Create Items', 'Can add new items to inventory', 'items'],
    ['items.edit', 'Edit Items', 'Can edit item information', 'items'],
    ['items.delete', 'Delete Items', 'Can delete items from inventory', 'items'],
    ['items.assign', 'Assign Items', 'Can assign items to employees', 'items'],
    ['items.import', 'Import Items', 'Can import items in bulk', 'items'],
    ['items.export', 'Export Items', 'Can export item data', 'items'],
    ['items.audit', 'Audit Items', 'Can perform inventory audits', 'items'],

    // Employee Management
    ['employees.view', 'View Employees', 'Can view employee list and details', 'employees'],
    ['employees.create', 'Create Employees', 'Can add new employees', 'employees'],
    ['employees.edit', 'Edit Employees', 'Can edit employee information', 'employees'],
    ['employees.delete', 'Delete Employees', 'Can delete employees', 'employees'],
    ['employees.assign_items', 'Assign Items to Employees', 'Can assign items to employees', 'employees'],

    // Software Management
    ['software.view', 'View Software', 'Can view software licenses', 'software'],
    ['software.create', 'Create Software', 'Can add new software licenses', 'software'],
    ['software.edit', 'Edit Software', 'Can edit software information', 'software'],
    ['software.delete', 'Delete Software', 'Can delete software licenses', 'software'],
    ['software.assign', 'Assign Software', 'Can assign software to employees', 'software'],
    ['software.audit', 'Audit Software', 'Can audit software usage and licenses', 'software'],

    // Reports and Analytics
    ['reports.view', 'View Reports', 'Can view system reports and analytics', 'reports'],
    ['reports.export', 'Export Reports', 'Can export reports and data', 'reports'],
    ['reports.create', 'Create Reports', 'Can create custom reports', 'reports'],

    // System Administration
    ['admin.settings', 'System Settings', 'Can modify system settings', 'admin'],
    ['admin.logs', 'View Activity Logs', 'Can view system activity logs', 'admin'],
    ['admin.notifications', 'Manage Notifications', 'Can manage system notifications', 'admin'],

    // Developer-specific permissions (renamed and expanded)
    ['dev.view', 'View Developer Tools', 'Can view developer tools and diagnostics', 'developer'],
    ['dev.database', 'Database Access', 'Can access database administration tools', 'developer'],
    ['dev.debug', 'Debug Mode', 'Can enable debug mode and view system internals', 'developer'],
    ['dev.console', 'Developer Console', 'Can access developer console and tools', 'developer'],
    ['dev.api', 'API Management', 'Can manage API endpoints and documentation', 'developer'],
    ['dev.migrations', 'Database Migrations', 'Can run database migrations and schema changes', 'developer'],
    ['dev.logs', 'System Logs', 'Can view detailed system and error logs', 'developer'],
    ['dev.performance', 'Performance Monitoring', 'Can access performance monitoring tools', 'developer'],
    ['dev.test', 'Run Tests', 'Can run automated tests and diagnostics', 'developer'],

    // Clients and Equipment
    ['clients.view', 'View Clients', 'Can view client information', 'clients'],
    ['clients.create', 'Create Clients', 'Can add new clients', 'clients'],
    ['clients.edit', 'Edit Clients', 'Can edit client information', 'clients'],
    ['clients.delete', 'Delete Clients', 'Can delete clients', 'clients'],

    ['printers.view', 'View Printers', 'Can view printer information', 'printers'],
    ['printers.create', 'Create Printers', 'Can add new printers', 'printers'],
    ['printers.edit', 'Edit Printers', 'Can edit printer information', 'printers'],
    ['printers.delete', 'Delete Printers', 'Can delete printers', 'printers'],

    ['pdas.view', 'View PDAs', 'Can view PDA information', 'pdas'],
    ['pdas.create', 'Create PDAs', 'Can add new PDAs', 'pdas'],
    ['pdas.edit', 'Edit PDAs', 'Can edit PDA information', 'pdas'],
    ['pdas.delete', 'Delete PDAs', 'Can delete PDAs', 'pdas'],

    ['sim_cards.view', 'View SIM Cards', 'Can view SIM card information', 'sim_cards'],
    ['sim_cards.create', 'Create SIM Cards', 'Can add new SIM cards', 'sim_cards'],
    ['sim_cards.edit', 'Edit SIM Cards', 'Can edit SIM card information', 'sim_cards'],
    ['sim_cards.delete', 'Delete SIM Cards', 'Can delete SIM cards', 'sim_cards'],

    // Reference Data
    ['references.view', 'View Reference Data', 'Access to reference data section', 'references'],
    ['references.manage', 'Manage Reference Data', 'Full access to manage all reference data', 'references'],

    // Asset Types
    ['asset_types.view', 'View Asset Types', 'View asset type listings and details', 'references'],
    ['asset_types.create', 'Create Asset Types', 'Create new asset types', 'references'],
    ['asset_types.edit', 'Edit Asset Types', 'Edit existing asset types', 'references'],
    ['asset_types.delete', 'Delete Asset Types', 'Delete asset types', 'references'],

    // Brands
    ['brands.view', 'View Brands', 'View brand listings and details', 'references'],
    ['brands.create', 'Create Brands', 'Create new brands', 'references'],
    ['brands.edit', 'Edit Brands', 'Edit existing brands', 'references'],
    ['brands.delete', 'Delete Brands', 'Delete brands', 'references'],

    // Statuses
    ['statuses.view', 'View Statuses', 'View status listings and details', 'references'],
    ['statuses.create', 'Create Statuses', 'Create new statuses', 'references'],
    ['statuses.edit', 'Edit Statuses', 'Edit existing statuses', 'references'],
    ['statuses.delete', 'Delete Statuses', 'Delete statuses', 'references'],

    // Locations
    ['locations.view', 'View Locations', 'View location listings and details', 'references'],
    ['locations.create', 'Create Locations', 'Create new locations', 'references'],
    ['locations.edit', 'Edit Locations', 'Edit existing locations', 'references'],
    ['locations.delete', 'Delete Locations', 'Delete locations', 'references'],

    // Departments
    ['departments.view', 'View Departments', 'View department listings and details', 'references'],
    ['departments.create', 'Create Departments', 'Create new departments', 'references'],
    ['departments.edit', 'Edit Departments', 'Edit existing departments', 'references'],
    ['departments.delete', 'Delete Departments', 'Delete departments', 'references']
  ];

  for (const [name, display_name, description, module] of permissions) {
    try {
      await db.query(`
        INSERT INTO permissions (name, display_name, description, module)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [name, display_name, description, module]);
    } catch (error) {
      console.log(`Permission ${name} already exists:`, error.message);
    }
  }

  // Insert roles
  console.log('Inserting roles...');
  const roles = [
    ['developer', 'Developer', 'Full system access with development tools and debugging capabilities', true],
    ['admin', 'Administrator', 'Administrative access with most permissions', true],
    ['manager', 'Manager', 'Management level access', false],
    ['user', 'Regular User', 'Basic user access', true],
    ['viewer', 'Viewer', 'Read-only access', false]
  ];

  for (const [name, display_name, description, is_system_role] of roles) {
    try {
      await db.query(`
        INSERT INTO roles (name, display_name, description, is_system_role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [name, display_name, description, is_system_role]);
    } catch (error) {
      console.log(`Role ${name} already exists:`, error.message);
    }
  }

  // Assign permissions to roles
  console.log('Assigning permissions to roles...');

  // Assign all permissions to developer role
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT
      (SELECT id FROM roles WHERE name = 'developer'),
      id
    FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

  // Assign most permissions to admin role (excluding some sensitive ones)
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT
      (SELECT id FROM roles WHERE name = 'admin'),
      id
    FROM permissions
    WHERE name NOT IN ('roles.delete', 'admin.database', 'admin.debug')
      AND name NOT LIKE 'dev.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

  // Assign management permissions to manager role
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT
      (SELECT id FROM roles WHERE name = 'manager'),
      id
    FROM permissions
    WHERE module IN ('items', 'employees', 'software', 'clients', 'printers', 'pdas', 'sim_cards', 'reports')
    AND name NOT LIKE '%.delete'
    AND name NOT LIKE 'dev.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

  // Assign basic permissions to user role
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT
      (SELECT id FROM roles WHERE name = 'user'),
      id
    FROM permissions
    WHERE name IN (
      'items.view', 'employees.view', 'software.view',
      'clients.view', 'printers.view', 'pdas.view', 'sim_cards.view'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

  // Assign view-only permissions to viewer role
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT
      (SELECT id FROM roles WHERE name = 'viewer'),
      id
    FROM permissions
    WHERE name LIKE '%.view'
    AND name NOT LIKE 'dev.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING
  `);

  // Create database functions
  console.log('Creating database functions...');

  // Function to check if user has permission
  await db.query(`
    CREATE OR REPLACE FUNCTION user_has_permission(user_id_param INTEGER, permission_name_param VARCHAR)
    RETURNS BOOLEAN AS $function$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id_param
        AND p.name = permission_name_param
      );
    END;
    $function$ LANGUAGE plpgsql;
  `);

  // Function to get user permissions
  await db.query(`
    CREATE OR REPLACE FUNCTION get_user_permissions(user_id_param INTEGER)
    RETURNS TABLE(permission_name VARCHAR, display_name VARCHAR, module VARCHAR) AS $function$
    BEGIN
      RETURN QUERY
      SELECT DISTINCT p.name, p.display_name, p.module
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = user_id_param
      ORDER BY p.module, p.display_name;
    END;
    $function$ LANGUAGE plpgsql;
  `);

  // Function to get user roles
  await db.query(`
    CREATE OR REPLACE FUNCTION get_user_roles(user_id_param INTEGER)
    RETURNS TABLE(role_id INTEGER, role_name VARCHAR, display_name VARCHAR, description TEXT) AS $function$
    BEGIN
      RETURN QUERY
      SELECT r.id, r.name, r.display_name, r.description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = user_id_param
      ORDER BY r.display_name;
    END;
    $function$ LANGUAGE plpgsql;
  `);

  // Function to check if user has role
  await db.query(`
    CREATE OR REPLACE FUNCTION user_has_role(user_id_param INTEGER, role_name_param VARCHAR)
    RETURNS BOOLEAN AS $function$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id_param
        AND r.name = role_name_param
      );
    END;
    $function$ LANGUAGE plpgsql;
  `);

  // Create triggers
  await db.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $function$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $function$ LANGUAGE plpgsql;
  `);

  await db.query(`
    DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
    CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  await db.query(`
    DROP TRIGGER IF EXISTS update_permissions_updated_at ON permissions;
    CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  // Create view for user permissions summary
  await db.query(`
    CREATE OR REPLACE VIEW user_permissions_summary AS
    SELECT
        u.id as user_id,
        u.name as user_name,
        u.email,
        array_agg(DISTINCT r.display_name ORDER BY r.display_name) as roles,
        array_agg(DISTINCT p.name ORDER BY p.name) as permissions,
        COUNT(DISTINCT r.id) as role_count,
        COUNT(DISTINCT p.id) as permission_count
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    GROUP BY u.id, u.name, u.email;
  `);

  console.log('Database schema created successfully!');
}

// Function to fix existing user roles
async function fixUserRoles() {
  try {
    console.log('Fixing existing user roles...');

    // Get users without role assignments
    const usersWithoutRoles = await db.query(`
      SELECT u.id, u.name, u.role as old_role, u.email
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.user_id IS NULL
    `);

    console.log(`Found ${usersWithoutRoles.rows.length} users without role assignments`);

    for (const user of usersWithoutRoles.rows) {
      let roleName = 'user'; // default role

      // Check if user should be developer (email contains dev/developer)
      if (user.email && (user.email.toLowerCase().includes('dev') || user.email.toLowerCase().includes('developer'))) {
        roleName = 'developer';
      } else if (user.old_role === 'admin') {
        roleName = 'admin';
      } else if (user.old_role === 'manager') {
        roleName = 'manager';
      }

      const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [roleName]);

      if (roleResult.rows.length > 0) {
        await db.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
          VALUES ($1, $2, 1, NOW())
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, [user.id, roleResult.rows[0].id]);

        console.log(`✓ Assigned ${roleName} role to user ${user.name}`);
      }
    }

    console.log('User roles fixed successfully!');
  } catch (error) {
    console.error('Error fixing user roles:', error);
  }
}

// Function to test permissions
async function testPermissions() {
  try {
    console.log('\nTesting permission system...');

    // Test user_has_permission function
    const testUser = await db.query('SELECT id FROM users LIMIT 1');
    if (testUser.rows.length > 0) {
      const hasPermission = await db.query(
        'SELECT user_has_permission($1, $2) as has_permission',
        [testUser.rows[0].id, 'users.view']
      );
      console.log(`✓ Permission test: ${hasPermission.rows[0].has_permission}`);
    }

    // List all roles with their permission counts
    const rolesWithPermissions = await db.query(`
      SELECT r.name, r.display_name, COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.display_name
      ORDER BY r.name
    `);

    console.log('\nRoles and their permission counts:');
    rolesWithPermissions.rows.forEach(role => {
      console.log(`  ${role.display_name} (${role.name}): ${role.permission_count} permissions`);
    });

  } catch (error) {
    console.error('Error testing permissions:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => fixUserRoles())
    .then(() => testPermissions())
    .then(() => {
      console.log('\n🎉 Migration script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration, fixUserRoles, testPermissions };
