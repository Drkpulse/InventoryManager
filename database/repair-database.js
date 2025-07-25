const db = require('../src/config/db');

async function repairDatabase() {
  console.log('🔧 Starting comprehensive database repair...');
  
  try {
    // Ensure settings column exists and has correct type
    console.log('📝 Checking user settings column...');
    
    const settingsColumnExists = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'settings'
    `);
    
    if (settingsColumnExists.rows.length === 0) {
      console.log('➕ Adding settings column to users table...');
      await db.query('ALTER TABLE users ADD COLUMN settings JSONB DEFAULT \'{}\'::jsonb');
    } else if (settingsColumnExists.rows[0].data_type !== 'jsonb') {
      console.log('🔄 Converting settings column to JSONB...');
      await db.query('ALTER TABLE users ALTER COLUMN settings TYPE JSONB USING settings::jsonb');
    }
    
    // Run the migration for missing columns
    const addMissingColumns = require('./migrations/add-missing-columns');
    await addMissingColumns();
    
    // Update sample data with new fields
    console.log('📊 Updating sample data...');
    
    // Update printers with model, cost, and status
    await db.query(`
      UPDATE printers 
      SET model = CASE 
        WHEN supplier = 'HP Inc.' THEN 'LaserJet Pro 4000'
        WHEN supplier = 'Canon' THEN 'PIXMA MG3620'
        WHEN supplier = 'Epson' THEN 'EcoTank ET-2720'
        WHEN supplier = 'Brother' THEN 'HL-L2350DW'
        ELSE 'Generic Model'
      END,
      cost = CASE 
        WHEN supplier = 'HP Inc.' THEN 299.99
        WHEN supplier = 'Canon' THEN 79.99
        WHEN supplier = 'Epson' THEN 199.99
        WHEN supplier = 'Brother' THEN 149.99
        ELSE 150.00
      END,
      status_id = 1
      WHERE model IS NULL OR cost IS NULL OR status_id IS NULL
    `);
    
    // Update PDAs with model, cost, and status
    await db.query(`
      UPDATE pdas 
      SET model = CASE 
        WHEN serial_number = 'PDA001' THEN 'Zebra TC21'
        WHEN serial_number = 'PDA002' THEN 'Honeywell CT30'
        WHEN serial_number = 'PDA003' THEN 'Zebra TC26'
        WHEN serial_number = 'PDA004' THEN 'Datalogic Memor 10'
        WHEN serial_number = 'PDA005' THEN 'Zebra TC21'
        ELSE 'Generic PDA'
      END,
      cost = CASE 
        WHEN serial_number = 'PDA001' THEN 450.00
        WHEN serial_number = 'PDA002' THEN 380.00
        WHEN serial_number = 'PDA003' THEN 520.00
        WHEN serial_number = 'PDA004' THEN 395.00
        WHEN serial_number = 'PDA005' THEN 450.00
        ELSE 400.00
      END,
      status_id = CASE 
        WHEN serial_number = 'PDA004' THEN 2
        ELSE 1
      END
      WHERE model IS NULL OR cost IS NULL OR status_id IS NULL
    `);
    
    // Add sample SIM cards if table exists but is empty
    const simCardCount = await db.query('SELECT COUNT(*) FROM sim_cards');
    if (simCardCount.rows[0].count === '0') {
      console.log('➕ Adding sample SIM cards...');
      await db.query(`
        INSERT INTO sim_cards (sim_number, carrier, client_id, pda_id, monthly_cost, status_id) VALUES
        ('SIM001234567', 'Vodafone', 1, 1, 25.00, 1),
        ('SIM001234568', 'MEO', 1, NULL, 20.00, 1),
        ('SIM001234569', 'NOS', 2, 3, 30.00, 1),
        ('SIM001234570', 'Vodafone', 2, NULL, 25.00, 2),
        ('SIM001234571', 'MEO', 3, NULL, 20.00, 1),
        ('SIM001234572', 'Vodafone', 4, NULL, 25.00, 1),
        ('SIM001234573', 'NOS', 5, NULL, 30.00, 1),
        ('SIM001234574', 'MEO', 6, NULL, 20.00, 1)
      `);
    }
    
    // Add more clients if needed
    const clientCount = await db.query('SELECT COUNT(*) FROM clients');
    if (parseInt(clientCount.rows[0].count) < 6) {
      console.log('➕ Adding additional clients...');
      await db.query(`
        INSERT INTO clients (client_id, name, description) VALUES
        ('CLI004', 'PrintCorp Ltd', 'Printing and publishing services'),
        ('CLI005', 'DataLogistics Inc', 'Data collection and logistics'),
        ('CLI006', 'Mobile Solutions SA', 'Mobile device management')
        ON CONFLICT (client_id) DO NOTHING
      `);
    }
    
    // Update printer client assignments to use different clients
    await db.query(`
      UPDATE printers 
      SET client_id = CASE 
        WHEN id = 1 THEN 4
        WHEN id = 2 THEN 4
        WHEN id = 3 THEN 5
        WHEN id = 4 THEN 6
        ELSE client_id
      END
      WHERE client_id IN (1, 2, 3)
    `);
    
    // Verify database integrity
    console.log('🔍 Verifying database integrity...');
    
    const printerCheck = await db.query(`
      SELECT COUNT(*) as count,
             COUNT(CASE WHEN model IS NOT NULL THEN 1 END) as with_model,
             COUNT(CASE WHEN cost IS NOT NULL THEN 1 END) as with_cost,
             COUNT(CASE WHEN status_id IS NOT NULL THEN 1 END) as with_status
      FROM printers
    `);
    
    const pdaCheck = await db.query(`
      SELECT COUNT(*) as count,
             COUNT(CASE WHEN model IS NOT NULL THEN 1 END) as with_model,
             COUNT(CASE WHEN cost IS NOT NULL THEN 1 END) as with_cost,
             COUNT(CASE WHEN status_id IS NOT NULL THEN 1 END) as with_status
      FROM pdas
    `);
    
    const simCardTableExists = await db.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'sim_cards'
    `);
    
    console.log('📊 Database Status:');
    console.log(`   Printers: ${printerCheck.rows[0].count} total, ${printerCheck.rows[0].with_model} with model, ${printerCheck.rows[0].with_cost} with cost, ${printerCheck.rows[0].with_status} with status`);
    console.log(`   PDAs: ${pdaCheck.rows[0].count} total, ${pdaCheck.rows[0].with_model} with model, ${pdaCheck.rows[0].with_cost} with cost, ${pdaCheck.rows[0].with_status} with status`);
    console.log(`   SIM Cards table: ${simCardTableExists.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    console.log('✅ Database repair completed successfully!');
    
  } catch (error) {
    console.error('❌ Database repair failed:', error);
    throw error;
  }
}

// Run repair if called directly
if (require.main === module) {
  repairDatabase()
    .then(() => {
      console.log('🎉 Database repair completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Repair failed:', error);
      process.exit(1);
    });
}

module.exports = repairDatabase;