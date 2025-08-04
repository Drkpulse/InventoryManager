const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Update these with your DB credentials
const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const migrationPath = path.join(__dirname, '../migrations/add_user_settings.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration ran successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
