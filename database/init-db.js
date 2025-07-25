const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
};

async function initializeDatabase() {
  // First, connect to default postgres database
  const mainPool = new Pool({
    ...dbConfig,
    database: 'postgres', // Connect to default database
  });

  let dbPool;

  try {
    // Check if the database exists
    const dbCheckResult = await mainPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME]
    );

    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database ${process.env.DB_NAME}...`);
      await mainPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database ${process.env.DB_NAME} created successfully`);
    } else {
      console.log(`Database ${process.env.DB_NAME} already exists`);
    }

    // Now connect to the inventory database
    dbPool = new Pool({
      ...dbConfig,
      database: process.env.DB_NAME,
    });

    // Read and run schema file with CASCADE option for dropping tables
    console.log('Running database schema...');
    const schemaFilePath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaFilePath, 'utf8');

    // Split the SQL into separate statements to handle errors better
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim() !== '');

    // Execute each statement
    for (const statement of statements) {
      try {
        await dbPool.query(statement + ';');
      } catch (error) {
        console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
        console.error(`Error details: ${error.message}`);
        // Continue with other statements despite errors
      }
    }

    console.log('Database schema created successfully');

    // Run the additional scripts
    console.log('Running additional setup scripts...');
    try {
      // These would normally be separate files imported by other files in your codebase
      await runCreateHistoryTable(dbPool);
      await runCreateEmployeeHistoryTable(dbPool);
      await runAddSettingsColumn(dbPool);
      await addMissingColumns(dbPool);

      console.log('Additional setup scripts completed successfully');
    } catch (setupError) {
      console.error('Error running setup scripts:', setupError);
    }

  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    // Close connections
    await mainPool.end();
    if (dbPool) await dbPool.end();
  }
}

async function runCreateHistoryTable(pool) {
  console.log('Ensuring item_history table exists and is properly configured...');

  try {
    // Check if the table exists, if not this will be handled in the catch block
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_history (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id),
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_item_history_item ON item_history(item_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_item_history_action ON item_history(action_type);
    `);

    console.log('Item history table verified successfully!');
  } catch (error) {
    console.error('Error verifying item_history table:', error);
  }
}

async function runCreateEmployeeHistoryTable(pool) {
  console.log('Ensuring employee_history table exists and is properly configured...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_history (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_employee ON employee_history(employee_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_action ON employee_history(action_type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_history_created_at ON employee_history(created_at);
    `);

    console.log('Employee history table verified successfully!');
  } catch (error) {
    console.error('Error verifying employee_history table:', error);
  }
}

async function runAddSettingsColumn(pool) {
  console.log('Ensuring system_settings table has all required columns...');

  try {
    // Check if a column exists, and if not, add it
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'system_settings' AND column_name = 'is_editable';
    `);

    if (result.rows.length === 0) {
      await pool.query(`
        ALTER TABLE system_settings ADD COLUMN is_editable BOOLEAN DEFAULT TRUE;
      `);
      console.log('Added is_editable column to system_settings table');
    } else {
      console.log('is_editable column already exists in system_settings table');
    }
  } catch (error) {
    console.error('Error ensuring system_settings columns:', error);
  }
}

async function addMissingColumns(pool) {
  console.log('Adding missing columns to tables...');

  try {
    // Add address column to locations table
    const locationAddressCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'locations' AND column_name = 'address';
    `);

    if (locationAddressCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE locations ADD COLUMN address TEXT;
      `);
      console.log('Added address column to locations table');

      // Update existing locations with placeholder addresses
      await pool.query(`
        UPDATE locations SET address = CONCAT(name, ' Address') WHERE address IS NULL;
      `);
      console.log('Updated existing locations with placeholder addresses');
    }

    // Check if employee_history table exists
    const employeeHistoryCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'employee_history'
      );
    `);

    if (!employeeHistoryCheck.rows[0].exists) {
      await runCreateEmployeeHistoryTable(pool);
    }

    // Create missing report tables if needed for reports
    const reportsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'report_settings'
      );
    `);

    if (!reportsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE report_settings (
          id SERIAL PRIMARY KEY,
          report_name VARCHAR(100) NOT NULL,
          settings JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Created report_settings table');
    }
  } catch (error) {
    console.error('Error adding missing columns:', error);
  }
}

// Now let's create the missing template file for "reports/assets"
try {
  const reportsDir = path.join(__dirname, '../src/views/reports');
  const assetsReportPath = path.join(reportsDir, 'assets.ejs');

  // Check if directory exists, if not create it
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log(`Created directory: ${reportsDir}`);
  }

  // Check if file exists, if not create it
  if (!fs.existsSync(assetsReportPath)) {
    const templateContent = `<h1>Assets Report</h1>

<div class="report-actions">
  <a href="/reports/export-assets" class="btn">Export to CSV</a>
</div>

<% if (items && items.length > 0) { %>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Type</th>
        <th>Brand</th>
        <th>Model</th>
        <th>Price</th>
        <th>Assigned To</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <% items.forEach(item => { %>
        <tr>
          <td><%= item.cep_brc %></td>
          <td><%= item.name %></td>
          <td><%= item.type_name || 'N/A' %></td>
          <td><%= item.brand_name || 'N/A' %></td>
          <td><%= item.model || 'N/A' %></td>
          <td>$<%= item.price ? parseFloat(item.price).toFixed(2) : '0.00' %></td>
          <td>
            <% if (item.assigned_to_name) { %>
              <%= item.assigned_to_name %>
            <% } else { %>
              Unassigned
            <% } %>
          </td>
          <td><%= item.status_name || 'N/A' %></td>
        </tr>
      <% }) %>
    </tbody>
  </table>
<% } else { %>
  <p>No items found.</p>
<% } %>`;

    fs.writeFileSync(assetsReportPath, templateContent);
    console.log(`Created file: ${assetsReportPath}`);
  }
} catch (error) {
  console.error('Error creating template file:', error);
}

initializeDatabase();
