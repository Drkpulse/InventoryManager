const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function addSoftwareDescription() {
  try {
    console.log('Adding description column to software table...');

    // Check if description column already exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'software' AND column_name = 'description'
    `);

    if (columnCheck.rows.length === 0) {
      // Add description column
      await pool.query(`
        ALTER TABLE software
        ADD COLUMN description TEXT
      `);
      console.log('✓ Added description column to software table');
    } else {
      console.log('✓ Description column already exists in software table');
    }

    // Also add max_licenses column if it doesn't exist
    const maxLicensesCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'software' AND column_name = 'max_licenses'
    `);

    if (maxLicensesCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE software
        ADD COLUMN max_licenses INTEGER DEFAULT 1
      `);
      console.log('✓ Added max_licenses column to software table');
    } else {
      console.log('✓ Max_licenses column already exists in software table');
    }

    // Update existing software entries to have default max_licenses of 1
    await pool.query(`
      UPDATE software
      SET max_licenses = 1
      WHERE max_licenses IS NULL
    `);

    console.log('✓ Software table schema updated successfully!');

  } catch (error) {
    console.error('Error updating software table:', error);
  } finally {
    await pool.end();
  }
}

addSoftwareDescription();
