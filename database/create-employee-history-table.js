const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function createEmployeeHistoryTable() {
  const client = await pool.connect();

  try {
    console.log('🚀 Creating employee_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_history (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_employee
      ON employee_history(employee_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_action
      ON employee_history(action_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_created_at
      ON employee_history(created_at);
    `);

    console.log('✅ Employee history table created successfully!');

  } catch (error) {
    console.error('❌ Error creating employee history table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  createEmployeeHistoryTable()
    .then(() => {
      console.log('🎉 Employee history table setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createEmployeeHistoryTable };
