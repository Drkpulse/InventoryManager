const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
};

async function initializeDatabase() {
  // First, connect to default postgres database
  const mainPool = new Pool({
    ...dbConfig,
    database: 'postgres', // Connect to default database
  });

  let dbPool;

  try {
    console.log('🚀 Starting database initialization...');

    // Check if the database exists
    const dbCheckResult = await mainPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME]
    );

    if (dbCheckResult.rows.length === 0) {
      console.log(`📦 Creating database ${process.env.DB_NAME}...`);
      await mainPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`✅ Database ${process.env.DB_NAME} created successfully`);
    } else {
      console.log(`📋 Database ${process.env.DB_NAME} already exists`);
    }

    // Now connect to the inventory database
    dbPool = new Pool({
      ...dbConfig,
      database: process.env.DB_NAME,
    });

    // Run the complete database schema setup
    await runDatabaseSetup(dbPool);

    console.log('🎉 Database initialization completed successfully!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    // Close connections
    await mainPool.end();
    if (dbPool) await dbPool.end();
  }
}

async function runDatabaseSetup(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🗂️  Creating core database schema...');
    await createCoreSchema(client);

    console.log('👥 Setting up user management and permissions...');
    await setupUserManagement(client);

    console.log('🔔 Setting up notification system...');
    await setupNotificationSystem(client);

    console.log('📊 Creating status system with icons...');
    await setupStatusSystem(client);

    console.log('🏢 Setting up reference data...');
    await setupReferenceData(client);

    console.log('📦 Setting up inventory tables...');
    await setupInventoryTables(client);

    console.log('👷 Setting up employee and software management...');
    await setupEmployeeAndSoftware(client);

    console.log('🖨️  Setting up equipment management (printers, PDAs, SIM cards)...');
    await setupEquipmentManagement(client);

    console.log('📈 Setting up tracking and history...');
    await setupTrackingSystem(client);

    console.log('⚙️  Setting up system settings and triggers...');
    await setupSystemComponents(client);

    console.log('🌱 Inserting sample data...');
    await insertSampleData(client);

    console.log('📊 Creating indexes and optimizations...');
    await createIndexes(client);

    // Add this after all tables are created, before finishing setup
    await client.query(`
      CREATE OR REPLACE VIEW warranty_status_view AS
      SELECT
        i.id,
        i.cep_brc,
        i.name,
        i.warranty_start_date,
        i.warranty_end_date,
        i.warranty_months,
        CASE
          WHEN i.warranty_end_date IS NULL THEN NULL
          ELSE (i.warranty_end_date - CURRENT_DATE)
        END AS days_until_expiry,
        CASE
          WHEN i.warranty_end_date IS NULL THEN 'no_warranty'
          WHEN i.warranty_end_date < CURRENT_DATE THEN 'expired'
          WHEN i.warranty_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          WHEN i.warranty_end_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_later'
          ELSE 'active'
        END AS warranty_status,
        t.name AS type_name,
        b.name AS brand_name,
        e.name AS employee_name,
        d.name AS department_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id;
    `);

    console.log('🔄 Running database migrations...');
    await runMigrations(client);

    await client.query('COMMIT');
    console.log('✅ Database setup completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function createCoreSchema(client) {
  // Drop existing tables in proper order to handle dependencies
  await client.query(`
    DROP TABLE IF EXISTS notification_settings CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS notification_types CASCADE;
    DROP TABLE IF EXISTS user_roles CASCADE;
    DROP TABLE IF EXISTS role_permissions CASCADE;
    DROP TABLE IF EXISTS permissions CASCADE;
    DROP TABLE IF EXISTS roles CASCADE;
    DROP TABLE IF EXISTS sim_card_history CASCADE;
    DROP TABLE IF EXISTS pda_history CASCADE;
    DROP TABLE IF EXISTS printer_history CASCADE;
    DROP TABLE IF EXISTS client_history CASCADE;
    DROP TABLE IF EXISTS employee_history CASCADE;
    DROP TABLE IF EXISTS item_history CASCADE;
    DROP TABLE IF EXISTS sim_cards CASCADE;
    DROP TABLE IF EXISTS pdas CASCADE;
    DROP TABLE IF EXISTS printers CASCADE;
    DROP TABLE IF EXISTS clients CASCADE;
    DROP TABLE IF EXISTS employee_software CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    DROP TABLE IF EXISTS employees CASCADE;
    DROP TABLE IF EXISTS sales CASCADE;
    DROP TABLE IF EXISTS software CASCADE;
    DROP TABLE IF EXISTS activity_logs CASCADE;
    DROP TABLE IF EXISTS system_settings CASCADE;
    DROP TABLE IF EXISTS report_settings CASCADE;
    DROP TABLE IF EXISTS brands CASCADE;
    DROP TABLE IF EXISTS types CASCADE;
    DROP TABLE IF EXISTS statuses CASCADE;
    DROP TABLE IF EXISTS locations CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);

  // Create users table with all required fields
  await client.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      cep_id VARCHAR(50) UNIQUE NOT NULL,
      settings JSONB DEFAULT '{
        "language": "en",
        "theme": "light",
        "timezone": "UTC",
        "items_per_page": "20",
        "email_notifications": true,
        "browser_notifications": true,
        "maintenance_alerts": true,
        "assignment_notifications": true,
        "session_timeout": false,
        "two_factor_auth": false
      }'::jsonb,
      active BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupUserManagement(client) {
  // Create roles table
  await client.query(`
    CREATE TABLE roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_system_role BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create permissions table
  await client.query(`
    CREATE TABLE permissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      module VARCHAR(100) NOT NULL DEFAULT 'general',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create role_permissions junction table
  await client.query(`
    CREATE TABLE role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role_id, permission_id)
    )
  `);

  // Create user_roles junction table
  await client.query(`
    CREATE TABLE user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role_id)
    )
  `);
}

async function setupNotificationSystem(client) {
  // Create notification types table
  await client.query(`
    CREATE TABLE notification_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'fas fa-bell',
      color VARCHAR(20) DEFAULT '#4a6fa5',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create notifications table
  await client.query(`
    CREATE TABLE notifications (
      id SERIAL PRIMARY KEY,
      type_id INTEGER NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      url VARCHAR(255),
      data JSONB,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create notification settings table
  await client.query(`
    CREATE TABLE notification_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type_id INTEGER NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT TRUE,
      email_enabled BOOLEAN DEFAULT FALSE,
      browser_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, type_id)
    )
  `);
}

async function setupStatusSystem(client) {
  // Create statuses table with enhanced features
  await client.query(`
    CREATE TABLE statuses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'fas fa-tag',
      color VARCHAR(20) DEFAULT 'gray',
      is_active BOOLEAN DEFAULT TRUE,
      status_order INTEGER DEFAULT 999,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupReferenceData(client) {
  // Create departments table
  await client.query(`
    CREATE TABLE departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create locations table
  await client.query(`
    CREATE TABLE locations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      address TEXT,
      parent_id INTEGER REFERENCES locations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create types table
  await client.query(`
    CREATE TABLE types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create brands table
  await client.query(`
    CREATE TABLE brands (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupInventoryTables(client) {
  // Create sales/receipt table
  await client.query(`
    CREATE TABLE sales (
      receipt VARCHAR(255) PRIMARY KEY,
      supplier VARCHAR(255),
      date_acquired DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create software table
  await client.query(`
    CREATE TABLE software (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(100),
      license_type VARCHAR(100),
      cost_per_license DECIMAL(10, 2),
      vendor VARCHAR(255),
      description TEXT,
      max_licenses INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupEmployeeAndSoftware(client) {
  // Create employees table
  await client.query(`
    CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      cep VARCHAR(50) UNIQUE,
      email VARCHAR(255) UNIQUE,
      dept_id INTEGER REFERENCES departments(id),
      location_id INTEGER REFERENCES locations(id),
      joined_date DATE,
      left_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create employee_software junction table
  await client.query(`
    CREATE TABLE employee_software (
      id SERIAL PRIMARY KEY,
      software_id INTEGER REFERENCES software(id) ON DELETE CASCADE,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      assigned_date DATE DEFAULT CURRENT_DATE,
      license_key VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(software_id, employee_id)
    )
  `);

  // Create items table
  await client.query(`
    CREATE TABLE items (
      id SERIAL PRIMARY KEY,
      cep_brc VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      type_id INTEGER REFERENCES types(id),
      price DECIMAL(10, 2),
      brand_id INTEGER REFERENCES brands(id),
      model VARCHAR(255),
      serial_cod VARCHAR(255),
      receipt VARCHAR(255) REFERENCES sales(receipt),
      date_assigned DATE,
      assigned_to INTEGER REFERENCES employees(id),
      status_id INTEGER REFERENCES statuses(id),
      location_id INTEGER REFERENCES locations(id),
      description TEXT,
      notes TEXT,
      warranty_start_date DATE,
      warranty_end_date DATE,
      warranty_months INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupEquipmentManagement(client) {
  // Create clients table
  await client.query(`
    CREATE TABLE clients (
      id SERIAL PRIMARY KEY,
      client_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create printers table
  await client.query(`
    CREATE TABLE printers (
      id SERIAL PRIMARY KEY,
      supplier VARCHAR(255),
      model VARCHAR(255),
      employee_id INTEGER REFERENCES employees(id),
      client_id INTEGER REFERENCES clients(id),
      cost DECIMAL(10, 2),
      status_id INTEGER REFERENCES statuses(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create pdas table
  await client.query(`
    CREATE TABLE pdas (
      id SERIAL PRIMARY KEY,
      serial_number VARCHAR(255) UNIQUE NOT NULL,
      model VARCHAR(255),
      client_id INTEGER REFERENCES clients(id),
      cost DECIMAL(10, 2),
      status_id INTEGER REFERENCES statuses(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sim_cards table
  await client.query(`
    CREATE TABLE sim_cards (
      id SERIAL PRIMARY KEY,
      sim_number VARCHAR(255) UNIQUE NOT NULL,
      carrier VARCHAR(255),
      client_id INTEGER REFERENCES clients(id),
      pda_id INTEGER REFERENCES pdas(id),
      monthly_cost DECIMAL(10, 2),
      status_id INTEGER REFERENCES statuses(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupTrackingSystem(client) {
  // Create item_history table
  await client.query(`
    CREATE TABLE item_history (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create employee_history table
  await client.query(`
    CREATE TABLE employee_history (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create client_history table
  await client.query(`
    CREATE TABLE client_history (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create printer_history table
  await client.query(`
    CREATE TABLE printer_history (
      id SERIAL PRIMARY KEY,
      printer_id INTEGER REFERENCES printers(id),
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create pda_history table
  await client.query(`
    CREATE TABLE pda_history (
      id SERIAL PRIMARY KEY,
      pda_id INTEGER REFERENCES pdas(id),
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sim_card_history table
  await client.query(`
    CREATE TABLE sim_card_history (
      id SERIAL PRIMARY KEY,
      sim_card_id INTEGER REFERENCES sim_cards(id),
      action_type VARCHAR(50) NOT NULL,
      action_details JSONB,
      performed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create activity_logs table
  await client.query(`
    CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INTEGER,
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function setupSystemComponents(client) {
  // Create system_settings table
  await client.query(`
    CREATE TABLE system_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      description TEXT,
      is_editable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create report_settings table
  await client.query(`
    CREATE TABLE report_settings (
      id SERIAL PRIMARY KEY,
      report_name VARCHAR(100) NOT NULL,
      settings JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
  CREATE TABLE IF NOT EXISTS license_config (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) NOT NULL,
    valid_until TIMESTAMP,
    issued_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

  // Create helpful functions
  await createDatabaseFunctions(client);

  // Create triggers
  await createDatabaseTriggers(client);
}

async function createDatabaseFunctions(client) {
  // Function to find user by email or CEP ID for login
  await client.query(`
    DROP FUNCTION IF EXISTS find_user_by_login(TEXT);

    CREATE OR REPLACE FUNCTION find_user_by_login(login_input TEXT)
    RETURNS TABLE(
      id INTEGER,
      name VARCHAR,
      email VARCHAR,
      password VARCHAR,
      role VARCHAR,
      cep_id VARCHAR,
      active BOOLEAN,
      settings JSONB,
      last_login TIMESTAMP,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.active, u.settings, u.last_login, u.created_at, u.updated_at
      FROM users u
      WHERE (LOWER(u.email) = LOWER(login_input) OR LOWER(u.cep_id) = LOWER(login_input))
        AND u.active = TRUE
      LIMIT 1;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to check user permissions
  await client.query(`
    CREATE OR REPLACE FUNCTION user_has_permission(user_id_param INTEGER, permission_name_param VARCHAR)
    RETURNS BOOLEAN AS $$
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
    $$ LANGUAGE plpgsql;
  `);

  // Function to get user permissions
  await client.query(`
    CREATE OR REPLACE FUNCTION get_user_permissions(user_id_param INTEGER)
    RETURNS TABLE(permission_name VARCHAR, display_name VARCHAR, module VARCHAR) AS $$
    BEGIN
      RETURN QUERY
      SELECT DISTINCT p.name, p.display_name, p.module
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = user_id_param
      ORDER BY p.module, p.display_name;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to get user roles
  await client.query(`
    CREATE OR REPLACE FUNCTION get_user_roles(user_id_param INTEGER)
    RETURNS TABLE(role_id INTEGER, role_name VARCHAR, display_name VARCHAR, description TEXT) AS $$
    BEGIN
      RETURN QUERY
      SELECT r.id, r.name, r.display_name, r.description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = user_id_param
      ORDER BY r.display_name;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to check if user has role
  await client.query(`
    CREATE OR REPLACE FUNCTION user_has_role(user_id_param INTEGER, role_name_param VARCHAR)
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id_param
        AND r.name = role_name_param
      );
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function for automatic timestamp updates
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to create default notification settings for new users
  await client.query(`
    CREATE OR REPLACE FUNCTION create_default_notification_settings()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
      SELECT
        NEW.id as user_id,
        nt.id as type_id,
        TRUE as enabled,
        FALSE as email_enabled,
        TRUE as browser_enabled
      FROM notification_types nt;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Function to create notification settings for new notification types
  await client.query(`
    CREATE OR REPLACE FUNCTION create_notification_settings_for_new_type()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
      SELECT
        u.id as user_id,
        NEW.id as type_id,
        TRUE as enabled,
        FALSE as email_enabled,
        TRUE as browser_enabled
      FROM users u;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

async function createDatabaseTriggers(client) {
  // Create triggers for updated_at columns
  const tablesWithUpdatedAt = [
    'users', 'roles', 'permissions', 'departments', 'locations',
    'types', 'brands', 'statuses', 'employees', 'software',
    'items', 'clients', 'printers', 'pdas', 'sim_cards',
    'system_settings', 'notifications', 'notification_settings'
  ];

  for (const table of tablesWithUpdatedAt) {
    await client.query(`
      DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
      CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  // Create notification triggers
  await client.query(`
    DROP TRIGGER IF EXISTS trigger_create_notification_settings ON users;
    CREATE TRIGGER trigger_create_notification_settings
      AFTER INSERT ON users
      FOR EACH ROW
      EXECUTE FUNCTION create_default_notification_settings();
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trigger_create_settings_for_new_type ON notification_types;
    CREATE TRIGGER trigger_create_settings_for_new_type
      AFTER INSERT ON notification_types
      FOR EACH ROW
      EXECUTE FUNCTION create_notification_settings_for_new_type();
  `);
}

async function insertSampleData(client) {
  // Insert default roles
  await client.query(`
    INSERT INTO roles (name, display_name, description, is_system_role) VALUES
    ('developer', 'Developer', 'Full system access with development tools and debugging capabilities', true),
    ('admin', 'Administrator', 'Administrative access with most permissions', false),
    ('manager', 'Manager', 'Management level access', false),
    ('user', 'Regular User', 'Basic user access', false),
    ('viewer', 'Viewer', 'Read-only access', true)
  `);

  // Insert comprehensive permissions
  const permissions = [
    // User Management
    ['users.view', 'View Users', 'Can view user list and details', 'users'],
    ['users.create', 'Create Users', 'Can create new users', 'users'],
    ['users.edit', 'Edit Users', 'Can edit user information', 'users'],
    ['users.delete', 'Delete Users', 'Can delete users', 'users'],
    ['users.manage_roles', 'Manage User Roles', 'Can assign/remove roles from users', 'users'],

    // Role Management
    ['roles.view', 'View Roles', 'Can view roles and permissions', 'roles'],
    ['roles.create', 'Create Roles', 'Can create new roles', 'roles'],
    ['roles.edit', 'Edit Roles', 'Can edit roles and their permissions', 'roles'],
    ['roles.delete', 'Delete Roles', 'Can delete non-system roles', 'roles'],

    // Item Management
    ['items.view', 'View Items', 'Can view inventory items', 'items'],
    ['items.create', 'Create Items', 'Can add new items to inventory', 'items'],
    ['items.edit', 'Edit Items', 'Can edit item information', 'items'],
    ['items.delete', 'Delete Items', 'Can delete items from inventory', 'items'],
    ['items.assign', 'Assign Items', 'Can assign items to employees', 'items'],

    // Employee Management
    ['employees.view', 'View Employees', 'Can view employee list and details', 'employees'],
    ['employees.create', 'Create Employees', 'Can add new employees', 'employees'],
    ['employees.edit', 'Edit Employees', 'Can edit employee information', 'employees'],
    ['employees.delete', 'Delete Employees', 'Can delete employees', 'employees'],

    // Software Management
    ['software.view', 'View Software', 'Can view software licenses', 'software'],
    ['software.create', 'Create Software', 'Can add new software licenses', 'software'],
    ['software.edit', 'Edit Software', 'Can edit software information', 'software'],
    ['software.delete', 'Delete Software', 'Can delete software licenses', 'software'],
    ['software.assign', 'Assign Software', 'Can assign software to employees', 'software'],

    // Reference Data
    ['asset_types.view', 'View Asset Types', 'View asset type listings and details', 'references'],
    ['asset_types.create', 'Create Asset Types', 'Create new asset types', 'references'],
    ['asset_types.edit', 'Edit Asset Types', 'Edit existing asset types', 'references'],
    ['asset_types.delete', 'Delete Asset Types', 'Delete asset types', 'references'],
    ['brands.view', 'View Brands', 'View brand listings and details', 'references'],
    ['brands.create', 'Create Brands', 'Create new brands', 'references'],
    ['brands.edit', 'Edit Brands', 'Edit existing brands', 'references'],
    ['brands.delete', 'Delete Brands', 'Delete brands', 'references'],
    ['statuses.view', 'View Statuses', 'View status listings and details', 'references'],
    ['statuses.create', 'Create Statuses', 'Create new statuses', 'references'],
    ['statuses.edit', 'Edit Statuses', 'Edit existing statuses', 'references'],
    ['statuses.delete', 'Delete Statuses', 'Delete statuses', 'references'],
    ['locations.view', 'View Locations', 'View location listings and details', 'references'],
    ['locations.create', 'Create Locations', 'Create new locations', 'references'],
    ['locations.edit', 'Edit Locations', 'Edit existing locations', 'references'],
    ['locations.delete', 'Delete Locations', 'Delete locations', 'references'],
    ['departments.view', 'View Departments', 'View department listings and details', 'references'],
    ['departments.create', 'Create Departments', 'Create new departments', 'references'],
    ['departments.edit', 'Edit Departments', 'Edit existing departments', 'references'],
    ['departments.delete', 'Delete Departments', 'Delete departments', 'references'],
    ['references.view', 'View Reference Data', 'Access to reference data section', 'references'],
    ['references.manage', 'Manage Reference Data', 'Full access to manage all reference data', 'references'],

    // Reports and Analytics
    ['reports.view', 'View Reports', 'Can view system reports and analytics', 'reports'],
    ['reports.export', 'Export Reports', 'Can export reports and data', 'reports'],

    // System Administration
    ['admin.settings', 'System Settings', 'Can modify system settings', 'admin'],
    ['admin.logs', 'View Activity Logs', 'Can view system activity logs', 'admin'],
    ['admin.notifications', 'Manage Notifications', 'Can manage system notifications', 'admin'],
    ['admin.database', 'Database Access', 'Can access database administration tools', 'admin'],
    ['admin.debug', 'Debug Mode', 'Can enable debug mode and view system internals', 'admin'],

    // Developer-specific permissions
    ['dev.console', 'Developer Console', 'Can access developer console and tools', 'developer'],
    ['dev.api', 'API Management', 'Can manage API endpoints and documentation', 'developer'],
    ['dev.migrations', 'Database Migrations', 'Can run database migrations and schema changes', 'developer'],
    ['dev.logs', 'System Logs', 'Can view detailed system and error logs', 'developer'],
    ['dev.performance', 'Performance Monitoring', 'Can access performance monitoring tools', 'developer'],

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
    ['sim_cards.delete', 'Delete SIM Cards', 'Can delete SIM cards', 'sim_cards']
  ];

  for (const [name, display_name, description, module] of permissions) {
    await client.query(`
      INSERT INTO permissions (name, display_name, description, module)
      VALUES ($1, $2, $3, $4)
    `, [name, display_name, description, module]);
  }

  // Assign permissions to roles
  await assignPermissionsToRoles(client);

  // Insert default statuses with icons and colors
  const statuses = [
    ['New', 'Newly acquired asset, not yet assigned or deployed', 'fas fa-star', 'blue', true, 1],
    ['Available', 'Asset is ready for assignment and available for use', 'fas fa-check-circle', 'green', true, 2],
    ['Assigned', 'Asset is currently assigned to an employee', 'fas fa-user-check', 'red', true, 3],
    ['Lost', 'Asset is reported lost', 'fas fa-exclamation-triangle', 'orange', false, 4],
    ['Maintenance', 'Asset is under maintenance or repair', 'fas fa-wrench', 'yellow', false, 5],
    ['Retired', 'Asset has been retired and is no longer in active use', 'fas fa-archive', 'gray', false, 6]
  ];

  for (const [name, description, icon, color, is_active, status_order] of statuses) {
    await client.query(`
      INSERT INTO statuses (name, description, icon, color, is_active, status_order)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [name, description, icon, color, is_active, status_order]);
  }

  // Insert notification types
  const notificationTypes = [
    ['system_welcome', 'Welcome Messages', 'fas fa-hand-wave', '#4a6fa5'],
    ['item_assignment', 'Item Assignment Notifications', 'fas fa-check-circle', '#2a9d8f'],
    ['item_unassignment', 'Item Unassignment Notifications', 'fas fa-minus-circle', '#e63946'],
    ['new_employee', 'New Employee Added', 'fas fa-user-plus', '#2a9d8f'],
    ['new_purchase', 'New Purchase Receipt', 'fas fa-shopping-cart', '#4a6fa5'],
    ['unassigned_items', 'Unassigned Items Alert', 'fas fa-exclamation-triangle', '#f6c23e'],
    ['low_stock', 'Low Stock Alert', 'fas fa-box-open', '#f6c23e'],
    ['system_update', 'System Updates', 'fas fa-cog', '#36b9cc'],
    ['password_expiry', 'Password Expiration Warning', 'fas fa-key', '#e63946'],
    ['maintenance_mode', 'Maintenance Mode Notifications', 'fas fa-tools', '#f6c23e'],
    ['software_assignment', 'Software License Assignment', 'fas fa-download', '#4a6fa5'],
    ['software_expiry', 'Software License Expiry Warning', 'fas fa-exclamation-circle', '#f6c23e']
  ];

  for (const [name, description, icon, color] of notificationTypes) {
    await client.query(`
      INSERT INTO notification_types (name, description, icon, color)
      VALUES ($1, $2, $3, $4)
    `, [name, description, icon, color]);
  }

  // Insert sample departments
  const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Operations'];
  for (const dept of departments) {
    await client.query(`
      INSERT INTO departments (name) VALUES ($1)
    `, [dept]);
  }

  // Insert sample locations
  const locations = [
    ['Main Office - Porto', 'Headquarters building in Porto', 'Rua Principal 123, Porto, Portugal', null],
    ['Branch Office - Lisbon', 'Branch office in Lisbon', 'Avenida da Liberdade 456, Lisboa, Portugal', null],
    ['IT Department - Porto', 'IT section in main office', 'Rua Principal 123, Porto, Portugal', 1],
    ['Marketing Department - Lisbon', 'Marketing section in branch office', 'Avenida da Liberdade 456, Lisboa, Portugal', 2],
    ['Warehouse', 'Storage facility', 'Zona Industrial, Porto, Portugal', null],
    ['Remote Work', 'Home office/remote location', 'Various locations', null]
  ];

  for (const [name, description, address, parent_id] of locations) {
    await client.query(`
      INSERT INTO locations (name, description, address, parent_id)
      VALUES ($1, $2, $3, $4)
    `, [name, description, address, parent_id]);
  }

  // Insert sample types
  const types = [
    ['Laptop', 'Portable computers'],
    ['Desktop', 'Stationary computers'],
    ['Monitor', 'Display devices'],
    ['Smartphone', 'Mobile phones with advanced features'],
    ['Tablet', 'Portable touchscreen devices'],
    ['Printer', 'Printing devices']
  ];

  for (const [name, description] of types) {
    await client.query(`
      INSERT INTO types (name, description) VALUES ($1, $2)
    `, [name, description]);
  }

  // Insert sample brands
  const brands = ['Dell', 'HP', 'Lenovo', 'Apple', 'Samsung'];
  for (const brand of brands) {
    await client.query(`
      INSERT INTO brands (name) VALUES ($1)
    `, [brand]);
  }

  // Insert sample software
  const software = [
    ['Microsoft Office 365', '2023', 'subscription', 12.50, 'Microsoft', 'Office productivity suite', 100],
    ['Google Workspace', 'Current', 'subscription', 6.00, 'Google', 'Cloud-based productivity tools', 50],
    ['Adobe Creative Cloud', '2023', 'subscription', 52.99, 'Adobe', 'Creative design software suite', 10],
    ['AutoCAD', '2023', 'subscription', 185.00, 'Autodesk', 'Computer-aided design software', 5],
    ['Sketch', '99', 'subscription', 9.00, 'Sketch', 'Digital design toolkit for Mac', 10],
    ['Slack', 'Current', 'subscription', 6.67, 'Slack Technologies', 'Team collaboration platform', 100],
    ['Microsoft Windows 11 Pro', '22H2', 'perpetual', 199.99, 'Microsoft', 'Operating system', 200],
    ['Antivirus Enterprise', '2023', 'subscription', 25.00, 'Various', 'Enterprise security solution', 200],
    ['Project Management Tool', '1.5', 'subscription', 15.00, 'Various', 'Project planning and tracking', 25]
  ];

  for (const [name, version, license_type, cost_per_license, vendor, description, max_licenses] of software) {
    await client.query(`
      INSERT INTO software (name, version, license_type, cost_per_license, vendor, description, max_licenses)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, version, license_type, cost_per_license, vendor, description, max_licenses]);
  }

  // Insert sample clients
  const clients = [
    ['CLI001', 'TechCorp Solutions', 'Main technology partner'],
    ['CLI002', 'Digital Services Ltd', 'Digital transformation services'],
    ['CLI003', 'Innovation Hub', 'Innovation and development center'],
    ['CLI004', 'PrintCorp Ltd', 'Printing and publishing services'],
    ['CLI005', 'DataLogistics Inc', 'Data collection and logistics'],
    ['CLI006', 'Mobile Solutions SA', 'Mobile device management']
  ];

  for (const [client_id, name, description] of clients) {
    await client.query(`
      INSERT INTO clients (client_id, name, description)
      VALUES ($1, $2, $3)
    `, [client_id, name, description]);
  }

  // Insert sample system settings
  const systemSettings = [
    ['company_name', 'Inventory Management Inc.', 'Company name displayed throughout the application'],
    ['items_per_page', '20', 'Number of items to display per page in listings'],
    ['enable_notifications', 'true', 'Whether to enable system notifications'],
    ['maintenance_mode', 'false', 'Whether the system is in maintenance mode'],
    ['default_language', 'en', 'Default language for the application'],
    ['backup_frequency', 'daily', 'How often to backup the database'],
    ['session_timeout', '30', 'Session timeout in minutes'],
    ['password_policy', 'strong', 'Password complexity requirements']
  ];

  for (const [key, value, description] of systemSettings) {
    await client.query(`
      INSERT INTO system_settings (setting_key, setting_value, description)
      VALUES ($1, $2, $3)
    `, [key, value, description]);
  }

  // Create admin user with password: admin
  await client.query(`
    INSERT INTO users (name, email, password, role, cep_id, settings, active, last_login)
    VALUES (
      'Admin User',
      'admin@example.com',
      '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW',
      'admin',
      'ADM001',
      '{
        "language": "en",
        "theme": "light",
        "timezone": "UTC",
        "items_per_page": "20",
        "email_notifications": true,
        "browser_notifications": true,
        "maintenance_alerts": true,
        "assignment_notifications": true,
        "session_timeout": false,
        "two_factor_auth": false
      }'::jsonb,
      true,
      CURRENT_TIMESTAMP
    )
  `);

  // Create additional sample users
  await client.query(`
    INSERT INTO users (name, email, password, role, cep_id, active)
    VALUES
    ('Regular User', 'user@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', 'USR002', true),
    ('Developer User', 'dev@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', 'DEV003', true),
    ('Manager User', 'manager@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', 'MGR004', true)
  `);

  // Assign roles to users
  await assignRolesToUsers(client);

  // Insert sample employees
  const employees = [
    ['John Doe', 'EMP001', 'john.doe@example.com', 1, 1, '2022-01-10'],
    ['Jane Smith', 'EMP002', 'jane.smith@example.com', 2, 4, '2022-03-15'],
    ['Robert Johnson', 'EMP003', 'robert.j@example.com', 1, 3, '2022-05-20'],
    ['Maria Silva', 'EMP004', 'maria.silva@example.com', 2, 2, '2022-07-01'],
    ['Carlos Santos', 'EMP005', 'carlos.santos@example.com', 6, 1, '2022-08-15']
  ];

  for (const [name, cep, email, location_id, dept_id, joined_date] of employees) {
    await client.query(`
      INSERT INTO employees (name, cep, email, location_id, dept_id, joined_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [name, cep, email, location_id, dept_id, joined_date]);
  }

  // Insert sample notifications
  await insertSampleNotifications(client);
}

async function assignPermissionsToRoles(client) {
  // Get role IDs
  const roles = await client.query('SELECT id, name FROM roles');
  const roleMap = {};
  roles.rows.forEach(role => {
    roleMap[role.name] = role.id;
  });

  // Get permission IDs
  const permissions = await client.query('SELECT id, name FROM permissions');
  const permissionMap = {};
  permissions.rows.forEach(perm => {
    permissionMap[perm.name] = perm.id;
  });

  // Assign all permissions to developer role
  for (const permId of Object.values(permissionMap)) {
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
    `, [roleMap.developer, permId]);
  }

  // Assign most permissions to super_admin role (excluding dev permissions)
  for (const [permName, permId] of Object.entries(permissionMap)) {
    if (!permName.startsWith('dev.')) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleMap.super_admin, permId]);
    }
  }

  // Assign admin permissions (excluding some sensitive ones)
  const excludedAdminPerms = ['roles.delete', 'admin.database', 'admin.debug'];
  for (const [permName, permId] of Object.entries(permissionMap)) {
    if (!permName.startsWith('dev.') && !excludedAdminPerms.includes(permName)) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleMap.admin, permId]);
    }
  }

  // Assign manager permissions
  const managerModules = ['items', 'employees', 'software', 'clients', 'printers', 'pdas', 'sim_cards', 'reports'];
  for (const [permName, permId] of Object.entries(permissionMap)) {
    const [module] = permName.split('.');
    if (managerModules.includes(module) && !permName.endsWith('.delete')) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleMap.manager, permId]);
    }
  }

  // Assign basic view permissions to user role
  const userPermissions = [
    'items.view', 'employees.view', 'software.view',
    'clients.view', 'printers.view', 'pdas.view', 'sim_cards.view'
  ];
  for (const permName of userPermissions) {
    if (permissionMap[permName]) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleMap.user, permissionMap[permName]]);
    }
  }

  // Assign view-only permissions to viewer role
  for (const [permName, permId] of Object.entries(permissionMap)) {
    if (permName.endsWith('.view') && !permName.startsWith('dev.')) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [roleMap.viewer, permId]);
    }
  }
}

async function assignRolesToUsers(client) {
  // Get role and user IDs
  const roles = await client.query('SELECT id, name FROM roles');
  const users = await client.query('SELECT id, email FROM users');

  const roleMap = {};
  roles.rows.forEach(role => {
    roleMap[role.name] = role.id;
  });

  // Assign roles based on user id and email patterns
  for (const user of users.rows) {
    let roleId;

    if (user.id === 1) {
      // Always assign developer role to user with id 1
      roleId = roleMap.developer;
    } else if (user.email.includes('admin')) {
      roleId = roleMap.admin;
    } else if (user.email.includes('manager')) {
      roleId = roleMap.manager;
    } else {
      roleId = roleMap.user;
    }

    await client.query(`
      INSERT INTO user_roles (user_id, role_id, assigned_by)
      VALUES ($1, $2, $3)
    `, [user.id, roleId, 1]); // Assigned by developer user (id=1)
  }
}

async function insertSampleNotifications(client) {
  // Get user and notification type IDs
  const users = await client.query('SELECT id, name FROM users LIMIT 3');
  const notificationTypes = await client.query('SELECT id, name FROM notification_types');

  const typeMap = {};
  notificationTypes.rows.forEach(type => {
    typeMap[type.name] = type.id;
  });

  // Insert sample notifications
  const notifications = [
    [typeMap.system_welcome, 1, 'Welcome to the Inventory System!', 'We are glad to have you on board. Explore the system to manage your inventory effectively.', null, '{"welcome_type": "admin"}'],
    [typeMap.software_assignment, 2, 'New Software License Assigned', 'Microsoft Office 365 has been assigned to your account. Please check your email for activation instructions.', '/employees/2', '{"software_id": 1, "license_key": "MSO365-GHI789"}'],
    [typeMap.item_assignment, 3, 'New Hardware Assignment', 'A new laptop has been assigned to you. Please contact IT to arrange pickup.', '/items', '{"item_id": 1, "action": "assigned"}']
  ];

  for (const [type_id, user_id, title, message, url, data] of notifications) {
    await client.query(`
      INSERT INTO notifications (type_id, user_id, title, message, url, data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [type_id, user_id, title, message, url, data]);
  }
}

async function createIndexes(client) {
  console.log('Creating performance indexes...');

  const indexes = [
    // User indexes
    'CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email))',
    'CREATE INDEX IF NOT EXISTS idx_users_cep_id_lower ON users (LOWER(cep_id))',
    'CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)',
    'CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING GIN (settings)',

    // Item indexes
    'CREATE INDEX IF NOT EXISTS idx_items_type ON items(type_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_brand ON items(brand_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_assigned_to ON items(assigned_to)',
    'CREATE INDEX IF NOT EXISTS idx_items_status ON items(status_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_cep_brc ON items(cep_brc)',

    // Employee indexes
    'CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(dept_id)',
    'CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_id)',
    'CREATE INDEX IF NOT EXISTS idx_employees_cep ON employees(cep)',

    // Software and assignments
    'CREATE INDEX IF NOT EXISTS idx_employee_software_employee ON employee_software(employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_employee_software_software ON employee_software(software_id)',
    'CREATE INDEX IF NOT EXISTS idx_software_max_licenses ON software(max_licenses)',

    // Notification indexes
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_type_id ON notifications(type_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_notification_settings_user_type ON notification_settings(user_id, type_id)',

    // Permission indexes
    'CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module)',
    'CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id)',
    'CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)',

    // History indexes
    'CREATE INDEX IF NOT EXISTS idx_item_history_item ON item_history(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_history_action ON item_history(action_type)',
    'CREATE INDEX IF NOT EXISTS idx_employee_history_employee ON employee_history(employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_employee_history_action ON employee_history(action_type)',
    'CREATE INDEX IF NOT EXISTS idx_employee_history_created_at ON employee_history(created_at)',

    // Activity logs
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)',

    // Equipment indexes
    'CREATE INDEX IF NOT EXISTS idx_printers_employee ON printers(employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_printers_client ON printers(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status_id)',
    'CREATE INDEX IF NOT EXISTS idx_pdas_client ON pdas(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_pdas_status ON pdas(status_id)',
    'CREATE INDEX IF NOT EXISTS idx_sim_cards_client ON sim_cards(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_sim_cards_pda ON sim_cards(pda_id)',
    'CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status_id)',

    // History indexes for equipment
    'CREATE INDEX IF NOT EXISTS idx_client_history_client ON client_history(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_printer_history_printer ON printer_history(printer_id)',
    'CREATE INDEX IF NOT EXISTS idx_pda_history_pda ON pda_history(pda_id)',
    'CREATE INDEX IF NOT EXISTS idx_sim_card_history_sim_card ON sim_card_history(sim_card_id)',

    // Status and reference data
    'CREATE INDEX IF NOT EXISTS idx_statuses_is_active ON statuses(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_statuses_status_order ON statuses(status_order)',
    'CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON locations(parent_id)'
  ];

  for (const indexQuery of indexes) {
    try {
      await client.query(indexQuery);
    } catch (error) {
      console.log(`ℹ️  Index already exists or couldn't be created: ${error.message}`);
    }
  }
}

// Create the missing template file for reports/assets
function createReportsTemplate() {
  try {
    const reportsDir = path.join(__dirname, '../src/views/reports');
    const assetsReportPath = path.join(reportsDir, 'assets.ejs');

    // Check if directory exists, if not create it
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log(`📁 Created directory: ${reportsDir}`);
    }

    // Check if file exists, if not create it
    if (!fs.existsSync(assetsReportPath)) {
      const templateContent = `<h1>Assets Report</h1>

<div class="report-actions">
  <a href="/reports/export-assets" class="btn">Export to CSV</a>
</div>

<% if (items && items.length > 0) { %>
  <table class="table table-striped">
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Type</th>
        <th>Brand</th>
        <th>Model</th>
        <th>Price</th>
        <th>Assigned To</th>
        <th>Status</th>
        <th>Location</th>
      </tr>
    </thead>
    <tbody>
      <% items.forEach(item => { %>
        <tr>
          <td><%= item.cep_brc %></td>
          <td><%= item.name %></td>
          <td><%= item.type_name || 'N/A' %></td>
          <td><%= item.brand_name || 'N/A' %></td>
          <td><%= item.model || 'N/A' %></td>
          <td>$<%= item.price ? parseFloat(item.price).toFixed(2) : '0.00' %></td>
          <td>
            <% if (item.assigned_to_name) { %>
              <%= item.assigned_to_name %>
            <% } else { %>
              <span class="text-muted">Unassigned</span>
            <% } %>
          </td>
          <td>
            <% if (item.status_name) { %>
              <span class="badge badge-<%= item.status_color || 'secondary' %>">
                <i class="<%= item.status_icon || 'fas fa-tag' %>"></i>
                <%= item.status_name %>
              </span>
            <% } else { %>
              <span class="text-muted">N/A</span>
            <% } %>
          </td>
          <td><%= item.location_name || 'N/A' %></td>
        </tr>
      <% }) %>
    </tbody>
  </table>
<% } else { %>
  <div class="alert alert-info">
    <i class="fas fa-info-circle"></i>
    No items found.
  </div>
<% } %>`;

      fs.writeFileSync(assetsReportPath, templateContent);
      console.log(`📄 Created template file: ${assetsReportPath}`);
    }
  } catch (error) {
    console.error('⚠️  Error creating template file:', error);
  }
}

// Run the initialization
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('\n✅ Database initialization completed successfully!');
      console.log('\n📋 Setup Summary:');
      console.log('- ✅ Database created and configured');
      console.log('- ✅ Complete schema with all tables');
      console.log('- ✅ User management and permissions system');
      console.log('- ✅ Notification system');
      console.log('- ✅ Status system with icons and colors');
      console.log('- ✅ Employee and software management');
      console.log('- ✅ Equipment management (printers, PDAs, SIM cards)');
      console.log('- ✅ History tracking for all entities');
      console.log('- ✅ Performance indexes');
      console.log('- ✅ Sample data inserted');
      console.log('\n👤 Default Admin User:');
      console.log('  Email: admin@example.com');
      console.log('  CEP ID: ADM001');
      console.log('  Password: admin');
      console.log('\n🎉 Your inventory management system is ready!');

      // Create reports template
      createReportsTemplate();

      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization failed:', error);
      process.exit(1);
    });
}

// Migration runner function
async function runMigrations(client) {
  try {
    console.log('📋 Checking for database migrations...');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS database_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found, skipping...');
      return;
    }

    // Read all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure alphabetical order

    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found');
      return;
    }

    console.log(`📝 Found ${migrationFiles.length} migration file(s)`);

    for (const filename of migrationFiles) {
      // Check if migration was already applied
      const result = await client.query(
        'SELECT COUNT(*) FROM database_migrations WHERE filename = $1',
        [filename]
      );

      if (parseInt(result.rows[0].count) > 0) {
        console.log(`⏭️  Migration already applied: ${filename}`);
        continue;
      }

      console.log(`🔄 Applying migration: ${filename}`);

      // Read and execute migration file
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Calculate checksum for integrity
      const crypto = require('crypto');
      const checksum = crypto.createHash('sha256').update(migrationSQL).digest('hex');

      try {
        // Execute migration within a savepoint
        await client.query('SAVEPOINT migration_point');
        await client.query(migrationSQL);

        // Record successful migration
        await client.query(
          'INSERT INTO database_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, checksum]
        );

        await client.query('RELEASE SAVEPOINT migration_point');
        console.log(`✅ Successfully applied migration: ${filename}`);

      } catch (migrationError) {
        await client.query('ROLLBACK TO SAVEPOINT migration_point');
        console.error(`❌ Failed to apply migration ${filename}:`, migrationError.message);
        throw migrationError;
      }
    }

    console.log('✅ All migrations completed successfully');

  } catch (error) {
    console.error('💥 Migration error:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };
