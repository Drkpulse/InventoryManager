const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function createLicenseTable() {
  const client = await pool.connect();

  try {
    console.log('🔧 Creating license management table...');

    // Create license_config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS license_config (
        id SERIAL PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        valid_until DATE,
        status VARCHAR(50) DEFAULT 'inactive',
        last_validated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validation_attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create unique constraint on license_key
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_license_key
      ON license_config(license_key);
    `);

    // Create function to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_license_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_license_updated_at ON license_config;
      CREATE TRIGGER trigger_license_updated_at
        BEFORE UPDATE ON license_config
        FOR EACH ROW
        EXECUTE FUNCTION update_license_updated_at();
    `);

    console.log('✅ License management table created successfully');

  } catch (error) {
    console.error('❌ Error creating license table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  createLicenseTable();
}

module.exports = createLicenseTable;
