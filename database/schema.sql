-- Database: inventory_db

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_types CASCADE;
DROP TABLE IF EXISTS item_history CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS types CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS software CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS statuses CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS employee_software CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create departments table
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create software table (renamed from offices)
CREATE TABLE software (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(100),
  license_type VARCHAR(100), -- 'perpetual', 'subscription', 'free', etc.
  cost_per_license DECIMAL(10, 2),
  vendor VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create statuses table
CREATE TABLE statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create locations table
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  parent_id INTEGER REFERENCES locations(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create employees table (removed platform_id and office_id)
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
);

-- Create employee_software junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS employee_software (
  id SERIAL PRIMARY KEY,
  software_id INTEGER REFERENCES software(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  assigned_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(software_id, employee_id)
);

-- Create types table
CREATE TABLE types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create brands table
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales/receipt table
CREATE TABLE sales (
  receipt VARCHAR(255) PRIMARY KEY,
  supplier VARCHAR(255),
  date_acquired DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create items table
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
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification types table
CREATE TABLE notification_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'fas fa-bell',
  color VARCHAR(20) DEFAULT '#4a6fa5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
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
);

-- Create notification settings table
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
);

-- Create item_history table
CREATE TABLE item_history (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_logs table
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system_settings table
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create printers table
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
);

-- Create pdas table
CREATE TABLE pdas (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(255) UNIQUE NOT NULL,
  model VARCHAR(255),
  client_id INTEGER REFERENCES clients(id),
  cost DECIMAL(10, 2),
  status_id INTEGER REFERENCES statuses(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sim_cards table
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
);

-- Create client_history table
CREATE TABLE client_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create printer_history table
CREATE TABLE printer_history (
  id SERIAL PRIMARY KEY,
  printer_id INTEGER REFERENCES printers(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create pda_history table
CREATE TABLE pda_history (
  id SERIAL PRIMARY KEY,
  pda_id INTEGER REFERENCES pdas(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sim_card_history table
CREATE TABLE sim_card_history (
  id SERIAL PRIMARY KEY,
  sim_card_id INTEGER REFERENCES sim_cards(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common queries
CREATE INDEX idx_items_type ON items(type_id);
CREATE INDEX idx_items_brand ON items(brand_id);
CREATE INDEX idx_items_assigned_to ON items(assigned_to);
CREATE INDEX idx_items_status ON items(status_id);
CREATE INDEX idx_items_location ON items(location_id);
CREATE INDEX idx_employees_dept ON employees(dept_id);
CREATE INDEX idx_employees_location ON employees(location_id);
CREATE INDEX idx_employee_software_employee ON employee_software(employee_id);
CREATE INDEX idx_employee_software_software ON employee_software(software_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type_id ON notifications(type_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notification_settings_user_type ON notification_settings(user_id, type_id);
CREATE INDEX idx_item_history_item ON item_history(item_id);
CREATE INDEX idx_item_history_action ON item_history(action_type);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_employee_software_software_id ON employee_software(software_id);
CREATE INDEX IF NOT EXISTS idx_employee_software_employee_id ON employee_software(employee_id);
CREATE INDEX IF NOT EXISTS idx_printers_employee ON printers(employee_id);
CREATE INDEX IF NOT EXISTS idx_printers_client ON printers(client_id);
CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status_id);
CREATE INDEX IF NOT EXISTS idx_pdas_client ON pdas(client_id);
CREATE INDEX IF NOT EXISTS idx_pdas_status ON pdas(status_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_client ON sim_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_pda ON sim_cards(pda_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status_id);
CREATE INDEX IF NOT EXISTS idx_client_history_client ON client_history(client_id);
CREATE INDEX IF NOT EXISTS idx_printer_history_printer ON printer_history(printer_id);
CREATE INDEX IF NOT EXISTS idx_pda_history_pda ON pda_history(pda_id);
CREATE INDEX IF NOT EXISTS idx_sim_card_history_sim_card ON sim_card_history(sim_card_id);

-- Create an admin user (password: admin)
INSERT INTO users (name, email, password, role, last_login)
VALUES ('Admin User', 'admin@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'admin', CURRENT_TIMESTAMP);

-- Add more users needed by notifications
INSERT INTO users (id, name, email, password, role, last_login)
VALUES
  (2, 'Regular User', 'user@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', CURRENT_TIMESTAMP),
  (3, 'Developer User', 'dev@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', CURRENT_TIMESTAMP);

-- Insert sample data for departments
INSERT INTO departments (name) VALUES
  ('IT'),
  ('HR'),
  ('Finance'),
  ('Marketing'),
  ('Operations');

-- Insert sample statuses
INSERT INTO statuses (name, description) VALUES
  ('Active', 'Item is currently in use'),
  ('In Storage', 'Item is in storage/inventory'),
  ('Maintenance', 'Item is under maintenance'),
  ('Retired', 'Item is no longer in use'),
  ('Lost', 'Item is reported missing');

-- Insert sample locations
INSERT INTO locations (name, description, address) VALUES
  ('Main Office - Porto', 'Headquarters building in Porto', 'Rua Principal 123, Porto, Portugal'),
  ('Branch Office - Lisbon', 'Branch office in Lisbon', 'Avenida da Liberdade 456, Lisboa, Portugal'),
  ('IT Department - Porto', 'IT section in main office', 'Rua Principal 123, Porto, Portugal'),
  ('Marketing Department - Lisbon', 'Marketing section in branch office', 'Avenida da Liberdade 456, Lisboa, Portugal'),
  ('Warehouse', 'Storage facility', 'Zona Industrial, Porto, Portugal'),
  ('Remote Work', 'Home office/remote location', 'Various locations');

-- Insert sample data for types
INSERT INTO types (name, description) VALUES
  ('Laptop', 'Portable computers'),
  ('Desktop', 'Stationary computers'),
  ('Monitor', 'Display devices'),
  ('Smartphone', 'Mobile phones with advanced features'),
  ('Tablet', 'Portable touchscreen devices'),
  ('Printer', 'Printing devices');

-- Insert sample data for brands
INSERT INTO brands (name) VALUES
  ('Dell'),
  ('HP'),
  ('Lenovo'),
  ('Apple'),
  ('Samsung');

-- Insert sample data for software
INSERT INTO software (name, version, license_type, cost_per_license, vendor) VALUES
  ('Microsoft Office 365', '2023', 'subscription', 12.50, 'Microsoft'),
  ('Google Workspace', 'Current', 'subscription', 6.00, 'Google'),
  ('Adobe Creative Cloud', '2023', 'subscription', 52.99, 'Adobe'),
  ('AutoCAD', '2023', 'subscription', 185.00, 'Autodesk'),
  ('Sketch', '99', 'subscription', 9.00, 'Sketch'),
  ('Slack', 'Current', 'subscription', 6.67, 'Slack Technologies'),
  ('Microsoft Windows 11 Pro', '22H2', 'perpetual', 199.99, 'Microsoft'),
  ('Antivirus Enterprise', '2023', 'subscription', 25.00, 'Various'),
  ('Project Management Tool', '1.5', 'subscription', 15.00, 'Various');

-- Insert sample data for sales
INSERT INTO sales (receipt, supplier, date_acquired) VALUES
  ('INV-2023-001', 'Tech Supplier Inc.', '2023-01-15'),
  ('INV-2023-002', 'Office Equipment Ltd.', '2023-02-20'),
  ('INV-2023-003', 'Computer World', '2023-03-10');

-- Insert sample data for employees
INSERT INTO employees (name, cep, email, location_id, dept_id, joined_date) VALUES
  ('John Doe', 'EMP001', 'john.doe@example.com', 1, 1, '2022-01-10'),
  ('Jane Smith', 'EMP002', 'jane.smith@example.com', 2, 4, '2022-03-15'),
  ('Robert Johnson', 'EMP003', 'robert.j@example.com', 1, 3, '2022-05-20'),
  ('Maria Silva', 'EMP004', 'maria.silva@example.com', 2, 2, '2022-07-01'),
  ('Carlos Santos', 'EMP005', 'carlos.santos@example.com', 6, 1, '2022-08-15');

-- Insert sample employee software assignments
INSERT INTO employee_software (employee_id, software_id, assigned_date, license_key, notes) VALUES
  (1, 1, '2022-01-15', 'MSO365-ABC123', 'Full Office suite for IT manager'),
  (1, 7, '2022-01-15', 'WIN11-XYZ789', 'Windows 11 Pro license'),
  (1, 8, '2022-01-15', 'AV-DEF456', 'Enterprise antivirus'),
  (2, 1, '2022-03-20', 'MSO365-GHI789', 'Office suite for marketing'),
  (2, 3, '2022-03-20', 'CC-JKL012', 'Creative Cloud for design work'),
  (2, 6, '2022-03-20', 'SLACK-MNO345', 'Team communication'),
  (3, 1, '2022-05-25', 'MSO365-PQR678', 'Office suite for finance'),
  (3, 9, '2022-05-25', 'PM-STU901', 'Project management access'),
  (4, 2, '2022-07-05', 'GWS-VWX234', 'Google Workspace for HR'),
  (4, 6, '2022-07-05', 'SLACK-YZA567', 'HR team communication'),
  (5, 1, '2022-08-20', 'MSO365-BCD890', 'Remote work Office suite'),
  (5, 7, '2022-08-20', 'WIN11-EFG123', 'Remote work Windows license');

-- Insert default notification types
INSERT INTO notification_types (name, description, icon, color) VALUES
('system_welcome', 'Welcome Messages', 'fas fa-hand-wave', '#4a6fa5'),
('item_assignment', 'Item Assignment Notifications', 'fas fa-check-circle', '#2a9d8f'),
('item_unassignment', 'Item Unassignment Notifications', 'fas fa-minus-circle', '#e63946'),
('new_employee', 'New Employee Added', 'fas fa-user-plus', '#2a9d8f'),
('new_purchase', 'New Purchase Receipt', 'fas fa-shopping-cart', '#4a6fa5'),
('unassigned_items', 'Unassigned Items Alert', 'fas fa-exclamation-triangle', '#f6c23e'),
('low_stock', 'Low Stock Alert', 'fas fa-box-open', '#f6c23e'),
('system_update', 'System Updates', 'fas fa-cog', '#36b9cc'),
('password_expiry', 'Password Expiration Warning', 'fas fa-key', '#e63946'),
('maintenance_mode', 'Maintenance Mode Notifications', 'fas fa-tools', '#f6c23e'),
('software_assignment', 'Software License Assignment', 'fas fa-download', '#4a6fa5'),
('software_expiry', 'Software License Expiry Warning', 'fas fa-exclamation-circle', '#f6c23e');

-- Insert sample system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('company_name', 'Inventory Management Inc.', 'Company name displayed throughout the application'),
  ('items_per_page', '20', 'Number of items to display per page in listings'),
  ('enable_notifications', 'true', 'Whether to enable system notifications'),
  ('maintenance_mode', 'false', 'Whether the system is in maintenance mode'),
  ('default_language', 'en', 'Default language for the application');

-- Insert sample clients
INSERT INTO clients (client_id, name, description) VALUES
  ('CLI001', 'TechCorp Solutions', 'Main technology partner'),
  ('CLI002', 'Digital Services Ltd', 'Digital transformation services'),
  ('CLI003', 'Innovation Hub', 'Innovation and development center'),
  ('CLI004', 'PrintCorp Ltd', 'Printing and publishing services'),
  ('CLI005', 'DataLogistics Inc', 'Data collection and logistics'),
  ('CLI006', 'Mobile Solutions SA', 'Mobile device management');

-- Insert sample printers (assigned to different clients than PDAs)
INSERT INTO printers (supplier, model, employee_id, client_id, cost, status_id) VALUES
  ('HP Inc.', 'LaserJet Pro 4000', 1, 4, 299.99, 1),
  ('Canon', 'PIXMA MG3620', 2, 4, 79.99, 1),
  ('Epson', 'EcoTank ET-2720', NULL, 5, 199.99, 1),
  ('Brother', 'HL-L2350DW', 3, 6, 149.99, 2);

-- Insert sample PDAs (assigned to different clients than printers)
INSERT INTO pdas (serial_number, model, client_id, cost, status_id) VALUES
  ('PDA001', 'Zebra TC21', 1, 450.00, 1),
  ('PDA002', 'Honeywell CT30', 1, 380.00, 1),
  ('PDA003', 'Zebra TC26', 2, 520.00, 1),
  ('PDA004', 'Datalogic Memor 10', 3, 395.00, 2),
  ('PDA005', 'Zebra TC21', 2, 450.00, 1);

-- Insert sample SIM cards (can be assigned to any client)
INSERT INTO sim_cards (sim_number, carrier, client_id, pda_id, monthly_cost, status_id) VALUES
  ('SIM001234567', 'Vodafone', 1, 1, 25.00, 1),
  ('SIM001234568', 'MEO', 1, NULL, 20.00, 1),
  ('SIM001234569', 'NOS', 2, 3, 30.00, 1),
  ('SIM001234570', 'Vodafone', 2, NULL, 25.00, 2),
  ('SIM001234571', 'MEO', 3, NULL, 20.00, 1),
  ('SIM001234572', 'Vodafone', 4, NULL, 25.00, 1),
  ('SIM001234573', 'NOS', 5, NULL, 30.00, 1),
  ('SIM001234574', 'MEO', 6, NULL, 20.00, 1);

-- Create default notification settings for all users and notification types
INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
SELECT
  u.id as user_id,
  nt.id as type_id,
  TRUE as enabled,
  FALSE as email_enabled,
  TRUE as browser_enabled
FROM users u
CROSS JOIN notification_types nt;

-- Insert sample notifications
INSERT INTO notifications (type_id, user_id, title, message, url, data) VALUES
(
  (SELECT id FROM notification_types WHERE name = 'system_welcome'),
  1,
  'Welcome to the Inventory System!',
  'We are glad to have you on board. Explore the system to manage your inventory effectively.',
  NULL,
  '{"welcome_type": "admin"}'
),
(
  (SELECT id FROM notification_types WHERE name = 'software_assignment'),
  2,
  'New Software License Assigned',
  'Microsoft Office 365 has been assigned to your account. Please check your email for activation instructions.',
  '/employees/2',
  '{"software_id": 1, "license_key": "MSO365-GHI789"}'
),
(
  (SELECT id FROM notification_types WHERE name = 'item_assignment'),
  3,
  'New Hardware Assignment',
  'A new laptop has been assigned to you. Please contact IT to arrange pickup.',
  '/items',
  '{"item_id": 1, "action": "assigned"}'
);

-- Insert sample data for item history
INSERT INTO item_history (item_id, action_type, action_details, performed_by) VALUES
  (1, 'created', '{"note": "Initial creation of the item."}', 1),
  (1, 'assigned', '{"to": "John Doe", "date": "2023-01-20"}', 1),
  (2, 'created', '{"note": "Initial creation of the item."}', 1),
  (2, 'assigned', '{"to": "Jane Smith", "date": "2023-02-15"}', 1),
  (3, 'created', '{"note": "Initial creation of the item."}', 1),
  (3, 'assigned', '{"to": "Robert Johnson", "date": "2023-03-10"}', 1);

-- Insert sample activity logs
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
  (1, 'login', 'users', 1, '{"browser": "Chrome", "os": "Windows"}', '192.168.1.1'),
  (1, 'create', 'items', 1, '{"name": "New Laptop", "type": "Laptop"}', '192.168.1.1'),
  (2, 'login', 'users', 2, '{"browser": "Firefox", "os": "MacOS"}', '192.168.1.2'),
  (2, 'view', 'items', 1, NULL, '192.168.1.2'),
  (1, 'update', 'employees', 1, '{"changed": ["software_assignments"]}', '192.168.1.1');

-- Create functions and triggers for automatic notification settings
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

CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

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

CREATE TRIGGER trigger_create_settings_for_new_type
  AFTER INSERT ON notification_types
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_new_type();
