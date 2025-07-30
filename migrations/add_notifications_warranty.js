// Migration script for notifications and warranty fields

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Create notification_types table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT 'fas fa-bell',
        color VARCHAR(20) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type_id INTEGER REFERENCES notification_types(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        url VARCHAR(500),
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create notification_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type_id INTEGER REFERENCES notification_types(id) ON DELETE CASCADE,
        enabled BOOLEAN DEFAULT TRUE,
        email_enabled BOOLEAN DEFAULT FALSE,
        browser_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, type_id)
      );
    `);

    // 4. Add warranty fields to items table
    await client.query(`
      ALTER TABLE items
      ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
      ADD COLUMN IF NOT EXISTS warranty_end_date DATE,
      ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12;
    `);

    // 5. Insert default notification types
    await client.query(`
      INSERT INTO notification_types (name, description, icon, color) VALUES
      ('system_alert', 'System alerts and maintenance notifications', 'fas fa-exclamation-triangle', '#f59e0b'),
      ('item_assignment', 'Item assignment and unassignment notifications', 'fas fa-user-check', '#10b981'),
      ('warranty_expiring', 'Warranty expiration warnings', 'fas fa-clock', '#f59e0b'),
      ('warranty_expired', 'Warranty expiration alerts', 'fas fa-exclamation-circle', '#ef4444'),
      ('admin_broadcast', 'Administrative broadcast messages', 'fas fa-bullhorn', '#dc2626'),
      ('employee_update', 'Employee information updates', 'fas fa-user-edit', '#6366f1'),
      ('item_update', 'Item information updates', 'fas fa-edit', '#8b5cf6')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 6. Create default notification settings for all users
    await client.query(`
      INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
      SELECT u.id, nt.id, TRUE, FALSE, TRUE
      FROM users u
      CROSS JOIN notification_types nt
      ON CONFLICT (user_id, type_id) DO NOTHING;
    `);

    // 7. Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_items_warranty_end_date ON items(warranty_end_date);`);

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
