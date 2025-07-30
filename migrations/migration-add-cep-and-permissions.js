// migration-add-cep-and-permissions.js
// Run with: node migration-add-cep-and-permissions.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration: Add CEP ID field and reference permissions...');

    // 1. Add CEP ID field to users table
    console.log('1. Adding cep_id field to users table...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cep_id VARCHAR(50) UNIQUE;
    `);

    // 2. Create index for case-insensitive searches
    console.log('2. Creating indexes for case-insensitive login...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_cep_id_lower ON users (LOWER(cep_id));
    `);

    // 3. Update existing admin user with a CEP ID
    console.log('3. Updating admin user with CEP ID...');
    await client.query(`
      UPDATE users
      SET cep_id = 'ADM001'
      WHERE email = 'admin@example.com' AND cep_id IS NULL;
    `);

    // Update other existing users with sample CEP IDs
    await client.query(`
      UPDATE users
      SET cep_id = 'USR' || LPAD(id::text, 3, '0')
      WHERE cep_id IS NULL;
    `);

    // 4. Make cep_id NOT NULL after populating existing records
    console.log('4. Making cep_id field required...');
    await client.query(`
      ALTER TABLE users
      ALTER COLUMN cep_id SET NOT NULL;
    `);

    // 5. Add reference data permissions
    console.log('5. Adding reference data permissions...');

    const referencePermissions = [
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
      ['departments.delete', 'Delete Departments', 'Delete departments', 'references'],

      // General references permission
      ['references.view', 'View Reference Data', 'Access to reference data section', 'references'],
      ['references.manage', 'Manage Reference Data', 'Full access to manage all reference data', 'references']
    ];

    for (const [name, display_name, description, module] of referencePermissions) {
      await client.query(`
        INSERT INTO permissions (name, display_name, description, module, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          module = EXCLUDED.module,
          updated_at = NOW()
      `, [name, display_name, description, module]);
    }

    // 6. Assign reference permissions to admin role
    console.log('6. Assigning reference permissions to admin role...');

    // Get admin role ID
    const adminRoleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
    `);

    if (adminRoleResult.rows.length > 0) {
      const adminRoleId = adminRoleResult.rows[0].id;

      // Get all reference permission IDs
      const permissionsResult = await client.query(`
        SELECT id FROM permissions WHERE module = 'references'
      `);

      for (const permission of permissionsResult.rows) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `, [adminRoleId, permission.id]);
      }
    } else {
      console.log('Warning: Admin role not found, skipping permission assignment');
    }

    // 7. Create or update helper functions for login
    console.log('7. Creating helper functions...');

    await client.query(`
      CREATE OR REPLACE FUNCTION find_user_by_login(login_input TEXT)
      RETURNS TABLE(id INTEGER, name VARCHAR, email VARCHAR, password VARCHAR, role VARCHAR, cep_id VARCHAR, last_login TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP) AS $$
      BEGIN
        RETURN QUERY
        SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.last_login, u.created_at, u.updated_at
        FROM users u
        WHERE LOWER(u.email) = LOWER(login_input)
           OR LOWER(u.cep_id) = LOWER(login_input)
        LIMIT 1;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 8. Update database functions if they exist
    console.log('8. Updating database functions...');

    // Check if role-based functions exist and update them if needed
    const functionsExist = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'get_user_permissions'
    `);

    if (parseInt(functionsExist.rows[0].count) === 0) {
      console.log('Creating user permission functions...');

      // Create roles table if it doesn't exist
      await client.query(`
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

      // Create permissions table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS permissions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          description TEXT,
          module VARCHAR(100) NOT NULL DEFAULT 'general',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create user_roles table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
          assigned_by INTEGER REFERENCES users(id),
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, role_id)
        )
      `);

      // Create role_permissions table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id SERIAL PRIMARY KEY,
          role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
          permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
          UNIQUE(role_id, permission_id)
        )
      `);

      // Create default roles
      await client.query(`
        INSERT INTO roles (name, display_name, description, is_system_role)
        VALUES
          ('admin', 'Administrator', 'Full system access', true),
          ('user', 'Standard User', 'Basic user access', true),
          ('manager', 'Manager', 'Management level access', false)
        ON CONFLICT (name) DO NOTHING
      `);

      // Create user permission functions
      await client.query(`
        CREATE OR REPLACE FUNCTION get_user_permissions(user_id_input INTEGER)
        RETURNS TABLE(permission_name VARCHAR) AS $$
        BEGIN
          RETURN QUERY
          SELECT DISTINCT p.name as permission_name
          FROM permissions p
          JOIN role_permissions rp ON p.id = rp.permission_id
          JOIN roles r ON rp.role_id = r.id
          JOIN user_roles ur ON r.id = ur.role_id
          WHERE ur.user_id = user_id_input;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION get_user_roles(user_id_input INTEGER)
        RETURNS TABLE(role_id INTEGER, role_name VARCHAR, display_name VARCHAR) AS $$
        BEGIN
          RETURN QUERY
          SELECT r.id as role_id, r.name as role_name, r.display_name
          FROM roles r
          JOIN user_roles ur ON r.id = ur.role_id
          WHERE ur.user_id = user_id_input;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION user_has_permission(user_id_input INTEGER, permission_name_input VARCHAR)
        RETURNS BOOLEAN AS $$
        BEGIN
          RETURN EXISTS(
            SELECT 1
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN roles r ON rp.role_id = r.id
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = user_id_input AND p.name = permission_name_input
          );
        END;
        $$ LANGUAGE plpgsql;
      `);
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

    // Display summary
    console.log('\n📊 Migration Summary:');
    console.log('- Added cep_id field to users table');
    console.log('- Created case-insensitive indexes for login');
    console.log('- Added 22 new reference data permissions');
    console.log('- Created helper function for flexible login');
    console.log('- Updated existing users with sample CEP IDs');

    // Display current user CEP IDs
    const users = await client.query('SELECT name, email, cep_id FROM users ORDER BY id');
    console.log('\n👥 Current Users:');
    users.rows.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) -> CEP: ${user.cep_id}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
