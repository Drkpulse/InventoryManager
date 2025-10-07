-- Database: inventory_db

-- Drop tables in reverse order of dependencies
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

-- Create license_config table
CREATE TABLE IF NOT EXISTS license_config (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  valid_until TIMESTAMP,
  issued_to VARCHAR(255),
  features JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validation_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the bypass/development license
-- Add unique constraint for license_key
ALTER TABLE license_config ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key);

-- Insert the bypass/development license
INSERT INTO license_config (license_key, company, valid_until, status, features, last_checked)
VALUES (
  'iambeirao',
  'Development/Testing',
  CURRENT_TIMESTAMP + INTERVAL '10 years',
  'active',
  '{"bypass": true, "testing": true, "development": true}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT (license_key) DO NOTHING;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  cep_id VARCHAR(50) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{
    "theme": "light",
    "language": "en",
    "items_per_page": "20",
    "maintenance_alerts": true,
    "session_timeout": false,
    "two_factor_auth": false
  }'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create departments table
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
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
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_months INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX idx_item_history_item ON item_history(item_id);
CREATE INDEX idx_item_history_action ON item_history(action_type);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_employee_software_software_id ON employee_software(software_id);
CREATE INDEX IF NOT EXISTS idx_employee_software_employee_id ON employee_software(employee_id);
CREATE INDEX IF NOT EXISTS idx_printers_employee ON printers(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);
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
CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING GIN (settings);
CREATE INDEX IF NOT EXISTS idx_users_cep_id ON users(cep_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Analytics tables indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON user_analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON user_analytics_events (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON user_analytics_events (event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON user_analytics_events (page_url, timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_session ON page_performance_metrics (session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user ON page_performance_metrics (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_page ON page_performance_metrics (page_url, timestamp);

CREATE INDEX IF NOT EXISTS idx_session_summary_session ON user_session_summary (session_id);
CREATE INDEX IF NOT EXISTS idx_session_summary_user ON user_session_summary (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_session_summary_time ON user_session_summary (start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_session ON cookie_consent_analytics (session_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user ON cookie_consent_analytics (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_type ON cookie_consent_analytics (consent_type, timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_aggregates_date ON performance_aggregates (date_period, period_type);

-- Create an admin user (password: admin)
INSERT INTO users (name, email, password, role, cep_id, settings, active, last_login)
VALUES ('Admin User', 'admin@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'admin', 'ADMIN001', '{
  "language": "en",
  "theme": "light",
  "timezone": "UTC",
  "items_per_page": "20",
  "maintenance_alerts": true,
  "session_timeout": false,
  "two_factor_auth": false
}'::jsonb, TRUE, CURRENT_TIMESTAMP);

-- Add more users
INSERT INTO users (id, name, email, password, role, cep_id, settings, active, last_login)
VALUES
  (2, 'Regular User', 'user@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', 'USER001', '{
    "language": "en",
    "theme": "light",
    "timezone": "UTC",
    "items_per_page": "20",
    "maintenance_alerts": true,
    "session_timeout": false,
    "two_factor_auth": false
  }'::jsonb, TRUE, CURRENT_TIMESTAMP),
  (3, 'Developer User', 'dev@example.com', '$2a$10$rVTD1ySZN5OtNkQ5C62yA.gutjwPM0h.i5.WDG7XyDpnSOGUK3PgW', 'user', 'DEV001', '{
    "language": "en",
    "theme": "dark",
    "timezone": "UTC",
    "items_per_page": "50",
    "maintenance_alerts": true,
    "session_timeout": false,
    "two_factor_auth": false
  }'::jsonb, TRUE, CURRENT_TIMESTAMP);

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
INSERT INTO employee_software (employee_id, software_id, assigned_date, notes) VALUES
  (1, 1, '2022-01-15', 'Full Office suite for IT manager'),
  (1, 7, '2022-01-15', 'Windows 11 Pro license'),
  (1, 8, '2022-01-15', 'Enterprise antivirus'),
  (2, 1, '2022-03-20', 'Office suite for marketing'),
  (2, 3, '2022-03-20', 'Creative Cloud for design work'),
  (2, 6, '2022-03-20', 'Team communication'),
  (3, 1, '2022-05-25', 'Office suite for finance'),
  (3, 9, '2022-05-25', 'Project management access'),
  (4, 2, '2022-07-05', 'Google Workspace for HR'),
  (4, 6, '2022-07-05', 'HR team communication'),
  (5, 1, '2022-08-20', 'Remote work Office suite'),
  (5, 7, '2022-08-20', 'Remote work Windows license');

-- Notification system has been removed as per migration 009
-- No notification types or settings are inserted

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

-- Notification system has been removed as per migration 009
-- No default notification settings or sample notifications are inserted

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

-- User Analytics Tables for Performance Tracking
-- User Analytics Events table for detailed user behavior tracking
CREATE TABLE IF NOT EXISTS user_analytics_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'click', 'form_submit', 'search', 'download', etc.
  page_url VARCHAR(500),
  page_title VARCHAR(200),
  element_id VARCHAR(100),
  element_class VARCHAR(100),
  element_text TEXT,
  time_spent_seconds INTEGER, -- Time spent on page or element
  scroll_depth FLOAT, -- Percentage of page scrolled
  click_x INTEGER, -- Mouse click coordinates
  click_y INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- For storing additional custom data
);

-- Page Performance Metrics table
CREATE TABLE IF NOT EXISTS page_performance_metrics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  page_url VARCHAR(500) NOT NULL,
  page_title VARCHAR(200),
  load_time_ms INTEGER, -- Page load time in milliseconds
  dom_ready_time_ms INTEGER,
  first_contentful_paint_ms INTEGER,
  largest_contentful_paint_ms INTEGER,
  cumulative_layout_shift FLOAT,
  first_input_delay_ms INTEGER,
  interaction_to_next_paint_ms INTEGER,
  memory_used_mb FLOAT,
  connection_type VARCHAR(50),
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
  browser VARCHAR(100),
  browser_version VARCHAR(50),
  os VARCHAR(100),
  screen_resolution VARCHAR(20),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Session Summary table for aggregated session data
CREATE TABLE IF NOT EXISTS user_session_summary (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  total_duration_seconds INTEGER,
  pages_visited INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_scroll_depth FLOAT DEFAULT 0,
  bounce_rate BOOLEAN DEFAULT FALSE, -- True if single page visit < 30 seconds
  conversion_events INTEGER DEFAULT 0, -- Forms submitted, downloads, etc.
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  exit_page VARCHAR(500),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  is_mobile BOOLEAN DEFAULT FALSE,
  country_code VARCHAR(5),
  city VARCHAR(100),
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cookie Consent Analytics table
CREATE TABLE IF NOT EXISTS cookie_consent_analytics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  consent_type VARCHAR(50) NOT NULL, -- 'accepted_all', 'rejected_all', 'customized', 'dismissed'
  performance_cookies BOOLEAN DEFAULT FALSE,
  preference_cookies BOOLEAN DEFAULT FALSE,
  analytics_cookies BOOLEAN DEFAULT FALSE,
  marketing_cookies BOOLEAN DEFAULT FALSE,
  consent_method VARCHAR(50), -- 'popup', 'banner', 'settings_page'
  time_to_consent_seconds INTEGER, -- How long user took to make decision
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Website Performance Aggregates table for quick dashboard queries
CREATE TABLE IF NOT EXISTS performance_aggregates (
  id SERIAL PRIMARY KEY,
  date_period DATE NOT NULL,
  period_type VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'monthly'
  unique_visitors INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_seconds FLOAT DEFAULT 0,
  avg_pages_per_session FLOAT DEFAULT 0,
  avg_load_time_ms FLOAT DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  conversion_rate FLOAT DEFAULT 0,
  cookie_consent_rate FLOAT DEFAULT 0,
  mobile_visitors_percentage FLOAT DEFAULT 0,
  top_pages JSONB,
  top_browsers JSONB,
  top_devices JSONB,
  performance_score FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_daily_aggregate UNIQUE (date_period, period_type)
);

-- Notification system functions and triggers have been removed as per migration 009

-- Create warranty status view
CREATE OR REPLACE VIEW warranty_status_view AS
SELECT
  i.id,
  i.cep_brc,
  i.name,
  i.warranty_start_date,
  i.warranty_end_date,
  i.warranty_months,
  -- Calculate days until expiry
  CASE
    WHEN i.warranty_end_date IS NULL THEN NULL
    ELSE (i.warranty_end_date - CURRENT_DATE)
  END AS days_until_expiry,
  -- Status logic
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
  updated_at TIMESTAMP,
  failed_login_attempts INTEGER,
  account_locked BOOLEAN,
  locked_at TIMESTAMP,
  locked_until TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.active, u.settings, u.last_login, u.created_at, u.updated_at,
         COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
         COALESCE(u.account_locked, FALSE) as account_locked,
         u.locked_at,
         u.locked_until
  FROM users u
  WHERE (LOWER(u.email) = LOWER(login_input) OR LOWER(u.cep_id) = LOWER(login_input))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
