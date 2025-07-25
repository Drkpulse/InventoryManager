const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function migrateToSoftwareSystem() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration from office/platform system to software system...');

    await client.query('BEGIN');

    // 1. Create software table
    console.log('📦 Creating software table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS software (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(100),
        license_type VARCHAR(100),
        cost_per_license DECIMAL(10, 2),
        vendor VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create employee_software junction table
    console.log('🔗 Creating employee_software junction table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_software (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        software_id INTEGER NOT NULL REFERENCES software(id) ON DELETE CASCADE,
        assigned_date DATE DEFAULT CURRENT_DATE,
        license_key VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, software_id)
      )
    `);

    // 3. Insert software data from offices table if it exists
    console.log('📋 Migrating office data to software...');
    const officesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'offices'
      )
    `);

    if (officesExist.rows[0].exists) {
      await client.query(`
        INSERT INTO software (name, license_type, vendor)
        SELECT name, 'subscription', 'Various' FROM offices
        ON CONFLICT DO NOTHING
      `);
      console.log('✅ Migrated office data to software');
    }

    // 4. Migrate employee office assignments to software assignments
    console.log('👥 Migrating employee office assignments...');
    const officeIdExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'office_id'
      )
    `);

    if (officeIdExists.rows[0].exists) {
      await client.query(`
        INSERT INTO employee_software (employee_id, software_id, assigned_date)
        SELECT e.id, s.id, CURRENT_DATE
        FROM employees e
        JOIN offices o ON e.office_id = o.id
        JOIN software s ON s.name = o.name
        WHERE e.office_id IS NOT NULL
        ON CONFLICT (employee_id, software_id) DO NOTHING
      `);
      console.log('✅ Migrated employee office assignments');
    }

    // 5. Remove platform_id and office_id columns from employees
    console.log('🗑️  Removing old columns from employees table...');
    const platformIdExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'platform_id'
      )
    `);

    if (platformIdExists.rows[0].exists) {
      await client.query('ALTER TABLE employees DROP COLUMN IF EXISTS platform_id');
      console.log('✅ Removed platform_id column');
    }

    if (officeIdExists.rows[0].exists) {
      await client.query('ALTER TABLE employees DROP COLUMN IF EXISTS office_id');
      console.log('✅ Removed office_id column');
    }

    // 6. Add location_id to employees if it doesn't exist
    console.log('📍 Adding location_id to employees...');
    const locationIdExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'location_id'
      )
    `);

    if (!locationIdExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE employees
        ADD COLUMN location_id INTEGER REFERENCES locations(id)
      `);
      console.log('✅ Added location_id column');
    }

    // 7. Drop platforms table if it exists
    console.log('🗑️  Dropping platforms table...');
    await client.query('DROP TABLE IF EXISTS platforms CASCADE');
    console.log('✅ Dropped platforms table');

    // 8. Drop offices table if it exists
    console.log('🗑️  Dropping offices table...');
    await client.query('DROP TABLE IF EXISTS offices CASCADE');
    console.log('✅ Dropped offices table');

    // 9. Add indexes for performance
    console.log('🚀 Adding indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_software_employee
      ON employee_software(employee_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_software_software
      ON employee_software(software_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_location
      ON employees(location_id)
    `);
    console.log('✅ Added indexes');

    // 10. Insert sample software if table is empty
    const softwareCount = await client.query('SELECT COUNT(*) FROM software');
    if (parseInt(softwareCount.rows[0].count) === 0) {
      console.log('📦 Inserting sample software...');
      await client.query(`
        INSERT INTO software (name, version, license_type, cost_per_license, vendor) VALUES
        ('Microsoft Office 365', '2023', 'subscription', 12.50, 'Microsoft'),
        ('Google Workspace', 'Current', 'subscription', 6.00, 'Google'),
        ('Adobe Creative Cloud', '2023', 'subscription', 52.99, 'Adobe'),
        ('AutoCAD', '2023', 'subscription', 185.00, 'Autodesk'),
        ('Sketch', '99', 'subscription', 9.00, 'Sketch'),
        ('Slack', 'Current', 'subscription', 6.67, 'Slack Technologies'),
        ('Microsoft Windows 11 Pro', '22H2', 'perpetual', 199.99, 'Microsoft'),
        ('Antivirus Enterprise', '2023', 'subscription', 25.00, 'Various'),
        ('Project Management Tool', '1.5', 'subscription', 15.00, 'Various')
      `);
      console.log('✅ Inserted sample software');
    }

    await client.query('COMMIT');
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateToSoftwareSystem()
    .then(() => {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToSoftwareSystem };
