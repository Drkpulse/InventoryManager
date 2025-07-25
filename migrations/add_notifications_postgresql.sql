-- Migration: Add comprehensive notification system to PostgreSQL database

-- Create notification types table
CREATE TABLE IF NOT EXISTS notification_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'fas fa-bell',
  color VARCHAR(20) DEFAULT '#4a6fa5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop the existing simple notifications table if it exists
DROP TABLE IF EXISTS notifications CASCADE;

-- Create enhanced notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for global notifications
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  url VARCHAR(255),
  data JSONB, -- Additional structured data
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type_id ON notifications(type_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_type ON notification_settings(user_id, type_id);

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
('maintenance_mode', 'Maintenance Mode Notifications', 'fas fa-tools', '#f6c23e')
ON CONFLICT (name) DO NOTHING;

-- Create default notification settings for existing users
INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
SELECT
  u.id as user_id,
  nt.id as type_id,
  TRUE as enabled,
  FALSE as email_enabled,
  TRUE as browser_enabled
FROM users u
CROSS JOIN notification_types nt
ON CONFLICT (user_id, type_id) DO NOTHING;

-- Insert sample notifications for existing users
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
  (SELECT id FROM notification_types WHERE name = 'password_expiry'),
  2,
  'Password Expiration Warning',
  'Your password will expire in 3 days. Please update it to maintain account security.',
  '/users/settings',
  '{"days_remaining": 3}'
),
(
  (SELECT id FROM notification_types WHERE name = 'item_assignment'),
  3,
  'Item Assignment',
  'A new item has been assigned to you. Please check the details in your items list.',
  '/items',
  '{"item_id": 1, "action": "assigned"}'
);

-- Create a function to automatically create notification settings for new users
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

-- Create trigger to automatically add notification settings for new users
DROP TRIGGER IF EXISTS trigger_create_notification_settings ON users;
CREATE TRIGGER trigger_create_notification_settings
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- Create a function to automatically create notification settings for new notification types
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

-- Create trigger to automatically add notification settings for new notification types
DROP TRIGGER IF EXISTS trigger_create_settings_for_new_type ON notification_types;
CREATE TRIGGER trigger_create_settings_for_new_type
  AFTER INSERT ON notification_types
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_new_type();
