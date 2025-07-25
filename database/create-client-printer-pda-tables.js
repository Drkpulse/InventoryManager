const db = require('../src/config/db');

async function createClientPrinterPDAMigration() {
  try {

    console.log('Creating clients table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating printers table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS printers (
        id SERIAL PRIMARY KEY,
        supplier VARCHAR(255),
        employee_id INTEGER REFERENCES employees(id),
        client_id INTEGER REFERENCES clients(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating pdas table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS pdas (
        id SERIAL PRIMARY KEY,
        serial_number VARCHAR(255) UNIQUE NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        has_sim_card BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating client_history table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS client_history (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id),
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating printer_history table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS printer_history (
        id SERIAL PRIMARY KEY,
        printer_id INTEGER REFERENCES printers(id),
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating pda_history table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS pda_history (
        id SERIAL PRIMARY KEY,
        pda_id INTEGER REFERENCES pdas(id),
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating indexes...');
    await db.query(`CREATE INDEX IF NOT EXISTS idx_printers_employee ON printers(employee_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_printers_client ON printers(client_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pdas_client ON pdas(client_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_client_history_client ON client_history(client_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_printer_history_printer ON printer_history(printer_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pda_history_pda ON pda_history(pda_id)`);

    console.log('Inserting sample data...');
    await db.query(`
      INSERT INTO clients (client_id, name, description) VALUES
      ('CLI001', 'TechCorp Solutions', 'Main technology partner'),
      ('CLI002', 'Digital Services Ltd', 'Digital transformation services'),
      ('CLI003', 'Innovation Hub', 'Innovation and development center')
      ON CONFLICT (client_id) DO NOTHING
    `);

    console.log('Client Printer PDA migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createClientPrinterPDAMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { createClientPrinterPDAMigration };