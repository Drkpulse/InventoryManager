// Create a file: setup-notifications-quick.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function quickSetup() {
  const client = await pool.connect();
  try {
    // Create basic notification tables
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type_id INTEGER REFERENCES notification_types(id),
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        url VARCHAR(500),
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert basic notification types
    await client.query(`
      INSERT INTO notification_types (name, description, icon, color) VALUES
      ('system_update', 'System Updates', 'fas fa-cog', '#3b82f6'),
      ('admin_broadcast', 'Admin Broadcast', 'fas fa-bullhorn', '#dc2626')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('✅ Quick notification setup completed');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

quickSetup();
