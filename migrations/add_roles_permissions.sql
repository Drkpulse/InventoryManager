-- Migration: Add roles and permissions system
-- File: migrations/add_roles_permissions.sql

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(100) NOT NULL, -- e.g., 'users', 'items', 'employees', etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- Cannot be deleted if true
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table (users can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Insert default permissions
INSERT INTO permissions (name, display_name, description, module) VALUES
-- User Management
('users.view', 'View Users', 'Can view user list and details', 'users'),
('users.create', 'Create Users', 'Can create new users', 'users'),
('users.edit', 'Edit Users', 'Can edit user information', 'users'),
('users.delete', 'Delete Users', 'Can delete users', 'users'),
('users.manage_roles', 'Manage User Roles', 'Can assign/remove roles from users', 'users'),

-- Role Management
('roles.view', 'View Roles', 'Can view roles and permissions', 'roles'),
('roles.create', 'Create Roles', 'Can create new roles', 'roles'),
('roles.edit', 'Edit Roles', 'Can edit roles and their permissions', 'roles'),
('roles.delete', 'Delete Roles', 'Can delete non-system roles', 'roles'),

-- Item Management
('items.view', 'View Items', 'Can view inventory items', 'items'),
('items.create', 'Create Items', 'Can add new items to inventory', 'items'),
('items.edit', 'Edit Items', 'Can edit item information', 'items'),
('items.delete', 'Delete Items', 'Can delete items from inventory', 'items'),
('items.assign', 'Assign Items', 'Can assign items to employees', 'items'),

-- Employee Management
('employees.view', 'View Employees', 'Can view employee list and details', 'employees'),
('employees.create', 'Create Employees', 'Can add new employees', 'employees'),
('employees.edit', 'Edit Employees', 'Can edit employee information', 'employees'),
('employees.delete', 'Delete Employees', 'Can delete employees', 'employees'),

-- Software Management
('software.view', 'View Software', 'Can view software licenses', 'software'),
('software.create', 'Create Software', 'Can add new software licenses', 'software'),
('software.edit', 'Edit Software', 'Can edit software information', 'software'),
('software.delete', 'Delete Software', 'Can delete software licenses', 'software'),
('software.assign', 'Assign Software', 'Can assign software to employees', 'software'),

-- Reports and Analytics
('reports.view', 'View Reports', 'Can view system reports and analytics', 'reports'),
('reports.export', 'Export Reports', 'Can export reports and data', 'reports'),

-- System Administration
('admin.settings', 'System Settings', 'Can modify system settings', 'admin'),
('admin.logs', 'View Activity Logs', 'Can view system activity logs', 'admin'),
('admin.notifications', 'Manage Notifications', 'Can manage system notifications', 'admin'),

-- Clients and Equipment
('clients.view', 'View Clients', 'Can view client information', 'clients'),
('clients.create', 'Create Clients', 'Can add new clients', 'clients'),
('clients.edit', 'Edit Clients', 'Can edit client information', 'clients'),
('clients.delete', 'Delete Clients', 'Can delete clients', 'clients'),

('printers.view', 'View Printers', 'Can view printer information', 'printers'),
('printers.create', 'Create Printers', 'Can add new printers', 'printers'),
('printers.edit', 'Edit Printers', 'Can edit printer information', 'printers'),
('printers.delete', 'Delete Printers', 'Can delete printers', 'printers'),

('pdas.view', 'View PDAs', 'Can view PDA information', 'pdas'),
('pdas.create', 'Create PDAs', 'Can add new PDAs', 'pdas'),
('pdas.edit', 'Edit PDAs', 'Can edit PDA information', 'pdas'),
('pdas.delete', 'Delete PDAs', 'Can delete PDAs', 'pdas'),

('sim_cards.view', 'View SIM Cards', 'Can view SIM card information', 'sim_cards'),
('sim_cards.create', 'Create SIM Cards', 'Can add new SIM cards', 'sim_cards'),
('sim_cards.edit', 'Edit SIM Cards', 'Can edit SIM card information', 'sim_cards'),
('sim_cards.delete', 'Delete SIM Cards', 'Can delete SIM cards', 'sim_cards');

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full system access with all permissions', true),
('admin', 'Administrator', 'Administrative access with most permissions', true),
('manager', 'Manager', 'Management level access', false),
('user', 'Regular User', 'Basic user access', true),
('viewer', 'Viewer', 'Read-only access', false);

-- Assign all permissions to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'super_admin'),
  id
FROM permissions;

-- Assign most permissions to admin role (excluding some sensitive ones)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
WHERE name NOT IN ('roles.delete', 'admin.settings');

-- Assign management permissions to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'manager'),
  id
FROM permissions
WHERE module IN ('items', 'employees', 'software', 'clients', 'printers', 'pdas', 'sim_cards', 'reports')
AND name NOT LIKE '%.delete';

-- Assign basic permissions to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'user'),
  id
FROM permissions
WHERE name IN (
  'items.view', 'employees.view', 'software.view',
  'clients.view', 'printers.view', 'pdas.view', 'sim_cards.view'
);

-- Assign view-only permissions to viewer role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'viewer'),
  id
FROM permissions
WHERE name LIKE '%.view';

-- Update existing users to have roles based on their current role column
-- First, assign super_admin role to users with 'admin' role
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  u.id,
  r.id,
  1 -- Assigned by first admin user
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin' AND r.name = 'super_admin';

-- Assign user role to users with 'user' role
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  u.id,
  r.id,
  1 -- Assigned by first admin user
FROM users u
CROSS JOIN roles r
WHERE u.role = 'user' AND r.name = 'user';

-- Create function to check if user has permission
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

-- Create function to get user permissions
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


-- Create function to get user roles
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

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
