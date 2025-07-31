// Complete migration script to fix notifications system
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
    console.log('Starting notification system migration...');

    // 1. Drop existing tables if they exist to start fresh
    await client.query('DROP TABLE IF EXISTS notifications CASCADE');
    await client.query('DROP TABLE IF EXISTS notification_settings CASCADE');
    await client.query('DROP TABLE IF EXISTS notification_types CASCADE');

    // 2. Create notification_types table
    await client.query(`
      CREATE TABLE notification_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT 'fas fa-bell',
        color VARCHAR(20) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create notifications table with proper structure
    await client.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        type_id INTEGER NOT NULL REFERENCES notification_types(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        url VARCHAR(500),
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create notification_settings table
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
      );
    `);

    // 5. Add warranty fields to items table if they don't exist
    await client.query(`
      ALTER TABLE items
      ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
      ADD COLUMN IF NOT EXISTS warranty_end_date DATE,
      ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12;
    `);

    // 6. Insert default notification types
    await client.query(`
      INSERT INTO notification_types (name, description, icon, color) VALUES
      ('system_welcome', 'Welcome Messages', 'fas fa-hand-wave', '#3b82f6'),
      ('item_assignment', 'Item Assignment Notifications', 'fas fa-check-circle', '#10b981'),
      ('item_unassignment', 'Item Unassignment Notifications', 'fas fa-minus-circle', '#ef4444'),
      ('new_employee', 'New Employee Added', 'fas fa-user-plus', '#10b981'),
      ('new_purchase', 'New Purchase Receipt', 'fas fa-shopping-cart', '#3b82f6'),
      ('unassigned_items', 'Unassigned Items Alert', 'fas fa-exclamation-triangle', '#f59e0b'),
      ('low_stock', 'Low Stock Alert', 'fas fa-box-open', '#f59e0b'),
      ('system_update', 'System Updates', 'fas fa-cog', '#06b6d4'),
      ('password_expiry', 'Password Expiration Warning', 'fas fa-key', '#ef4444'),
      ('maintenance_mode', 'Maintenance Mode Notifications', 'fas fa-tools', '#f59e0b'),
      ('warranty_expiring', 'Warranty Expiration Warnings', 'fas fa-clock', '#f59e0b'),
      ('warranty_expired', 'Warranty Expiration Alerts', 'fas fa-exclamation-circle', '#ef4444'),
      ('admin_broadcast', 'Administrative Broadcast Messages', 'fas fa-bullhorn', '#dc2626'),
      ('employee_update', 'Employee Information Updates', 'fas fa-user-edit', '#6366f1'),
      ('item_update', 'Item Information Updates', 'fas fa-edit', '#8b5cf6');
    `);

    // 7. Create default notification settings for all existing users
    await client.query(`
      INSERT INTO notification_settings (user_id, type_id, enabled, email_enabled, browser_enabled)
      SELECT u.id, nt.id, TRUE, FALSE, TRUE
      FROM users u
      CROSS JOIN notification_types nt
      ON CONFLICT (user_id, type_id) DO NOTHING;
    `);

    // 8. Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_type_id ON notifications(type_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notification_settings_user_type ON notification_settings(user_id, type_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_items_warranty_end_date ON items(warranty_end_date);`);

    // 9. Insert sample welcome notifications for existing users
    const usersResult = await client.query('SELECT id, name FROM users LIMIT 5');
    for (const user of usersResult.rows) {
      await client.query(`
        INSERT INTO notifications (type_id, user_id, title, message, data) VALUES
        ((SELECT id FROM notification_types WHERE name = 'system_welcome'), $1, $2, $3, $4)
      `, [
        user.id,
        'Welcome to the Inventory System!',
        `Hello ${user.name}! Welcome to our inventory management system. You can manage your assets and receive important notifications here.`,
        JSON.stringify({ welcome_type: 'user', user_name: user.name })
      ]);
    }

    // 10. Create functions for automatic settings creation
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

        -- Create welcome notification for new user
        INSERT INTO notifications (type_id, user_id, title, message, data) VALUES
        ((SELECT id FROM notification_types WHERE name = 'system_welcome'),
         NEW.id,
         'Welcome to the Inventory System!',
         'Hello ' || NEW.name || '! Welcome to our inventory management system. You can manage your assets and receive important notifications here.',
         jsonb_build_object('welcome_type', 'new_user', 'user_name', NEW.name));

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 11. Create trigger for new users
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_create_notification_settings ON users;
      CREATE TRIGGER trigger_create_notification_settings
        AFTER INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION create_default_notification_settings();
    `);

    // 12. Create function for new notification types
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

    // 13. Create trigger for new notification types
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_create_settings_for_new_type ON notification_types;
      CREATE TRIGGER trigger_create_settings_for_new_type
        AFTER INSERT ON notification_types
        FOR EACH ROW
        EXECUTE FUNCTION create_notification_settings_for_new_type();
    `);

    console.log('✅ Notification system migration completed successfully!');
    console.log('📊 Summary:');

    // Show summary
    const typesCount = await client.query('SELECT COUNT(*) FROM notification_types');
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    const settingsCount = await client.query('SELECT COUNT(*) FROM notification_settings');
    const notificationsCount = await client.query('SELECT COUNT(*) FROM notifications');

    console.log(`   - ${typesCount.rows[0].count} notification types created`);
    console.log(`   - ${settingsCount.rows[0].count} notification settings created for ${usersCount.rows[0].count} users`);
    console.log(`   - ${notificationsCount.rows[0].count} welcome notifications created`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await client.end();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
