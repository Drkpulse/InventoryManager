// Create database/add-employee-software-table.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function addEmployeeSoftwareTable() {
  try {
    console.log('Adding employee_software table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_software (
        id SERIAL PRIMARY KEY,
        software_id INTEGER REFERENCES software(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        assigned_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(software_id, employee_id)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_software_software_id ON employee_software(software_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_software_employee_id ON employee_software(employee_id);
    `);

    console.log('Employee software table and indexes created successfully!');
  } catch (error) {
    console.error('Error creating employee_software table:', error);
  } finally {
    await pool.end();
  }
}

addEmployeeSoftwareTable();
