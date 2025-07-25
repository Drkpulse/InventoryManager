-- Create notification types table
CREATE TABLE IF NOT EXISTS notification_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'fas fa-bell',
  color TEXT DEFAULT '#4a6fa5',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  url TEXT,
  user_id INTEGER, -- NULL for global notifications
  data TEXT, -- JSON data
  is_read BOOLEAN DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (type_id) REFERENCES notification_types(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type_id INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  email_enabled BOOLEAN DEFAULT 0,
  browser_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (type_id) REFERENCES notification_types(id),
  UNIQUE(user_id, type_id)
);

-- Insert default notification types
INSERT OR IGNORE INTO notification_types (name, description, icon, color) VALUES
('unassigned_items', 'Unassigned Items Alert', 'fas fa-exclamation-triangle', '#f6c23e'),
('new_employee', 'New Employee Added', 'fas fa-user-plus', '#2a9d8f'),
('new_purchase', 'New Purchase Receipt', 'fas fa-shopping-cart', '#4a6fa5'),
('item_assigned', 'Item Assignment', 'fas fa-check-circle', '#2a9d8f'),
('item_unassigned', 'Item Unassignment', 'fas fa-minus-circle', '#e63946'),
('low_stock', 'Low Stock Alert', 'fas fa-box-open', '#f6c23e'),
('system_update', 'System Updates', 'fas fa-cog', '#36b9cc');
