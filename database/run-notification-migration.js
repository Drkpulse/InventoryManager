const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runNotificationMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting notification system migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_notifications_postgresql.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Notification system migration completed successfully!');

    // Verify the migration by checking table existence
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('notification_types', 'notifications', 'notification_settings')
      ORDER BY table_name;
    `);

    console.log('📋 Created tables:', result.rows.map(row => row.table_name));

    // Check notification types
    const typesResult = await client.query('SELECT name FROM notification_types ORDER BY name');
    console.log('🔔 Available notification types:', typesResult.rows.map(row => row.name));

    // Check sample notifications
    const notificationsResult = await client.query('SELECT COUNT(*) as count FROM notifications');
    console.log(`📬 Sample notifications created: ${notificationsResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runNotificationMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runNotificationMigration };
