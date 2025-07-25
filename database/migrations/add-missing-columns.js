const db = require('../../src/config/db');

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to existing tables...');
  
  try {
    // Check if model column exists in printers table
    const printerColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'printers' AND column_name = 'model'
    `);
    
    if (printerColumns.rows.length === 0) {
      console.log('➕ Adding model column to printers table...');
      await db.query('ALTER TABLE printers ADD COLUMN model VARCHAR(255)');
    }
    
    // Check if cost column exists in printers table
    const printerCostColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'printers' AND column_name = 'cost'
    `);
    
    if (printerCostColumns.rows.length === 0) {
      console.log('➕ Adding cost column to printers table...');
      await db.query('ALTER TABLE printers ADD COLUMN cost DECIMAL(10, 2)');
    }
    
    // Check if status_id column exists in printers table
    const printerStatusColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'printers' AND column_name = 'status_id'
    `);
    
    if (printerStatusColumns.rows.length === 0) {
      console.log('➕ Adding status_id column to printers table...');
      await db.query('ALTER TABLE printers ADD COLUMN status_id INTEGER REFERENCES statuses(id)');
    }
    
    // Check if model column exists in pdas table
    const pdaColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pdas' AND column_name = 'model'
    `);
    
    if (pdaColumns.rows.length === 0) {
      console.log('➕ Adding model column to pdas table...');
      await db.query('ALTER TABLE pdas ADD COLUMN model VARCHAR(255)');
    }
    
    // Check if cost column exists in pdas table
    const pdaCostColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pdas' AND column_name = 'cost'
    `);
    
    if (pdaCostColumns.rows.length === 0) {
      console.log('➕ Adding cost column to pdas table...');
      await db.query('ALTER TABLE pdas ADD COLUMN cost DECIMAL(10, 2)');
    }
    
    // Check if status_id column exists in pdas table
    const pdaStatusColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pdas' AND column_name = 'status_id'
    `);
    
    if (pdaStatusColumns.rows.length === 0) {
      console.log('➕ Adding status_id column to pdas table...');
      await db.query('ALTER TABLE pdas ADD COLUMN status_id INTEGER REFERENCES statuses(id)');
    }
    
    // Remove has_sim_card column from pdas if it exists
    const hasSimCardColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pdas' AND column_name = 'has_sim_card'
    `);
    
    if (hasSimCardColumns.rows.length > 0) {
      console.log('➖ Removing has_sim_card column from pdas table...');
      await db.query('ALTER TABLE pdas DROP COLUMN has_sim_card');
    }
    
    // Create sim_cards table if it doesn't exist
    const simCardsTable = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sim_cards'
    `);
    
    if (simCardsTable.rows.length === 0) {
      console.log('➕ Creating sim_cards table...');
      await db.query(`
        CREATE TABLE sim_cards (
          id SERIAL PRIMARY KEY,
          sim_number VARCHAR(255) UNIQUE NOT NULL,
          carrier VARCHAR(255),
          client_id INTEGER REFERENCES clients(id),
          pda_id INTEGER REFERENCES pdas(id),
          monthly_cost DECIMAL(10, 2),
          status_id INTEGER REFERENCES statuses(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Create sim_card_history table if it doesn't exist
    const simCardHistoryTable = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sim_card_history'
    `);
    
    if (simCardHistoryTable.rows.length === 0) {
      console.log('➕ Creating sim_card_history table...');
      await db.query(`
        CREATE TABLE sim_card_history (
          id SERIAL PRIMARY KEY,
          sim_card_id INTEGER REFERENCES sim_cards(id),
          action_type VARCHAR(50) NOT NULL,
          action_details JSONB,
          performed_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Add indexes if they don't exist
    console.log('📊 Adding indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status_id)',
      'CREATE INDEX IF NOT EXISTS idx_pdas_status ON pdas(status_id)',
      'CREATE INDEX IF NOT EXISTS idx_sim_cards_client ON sim_cards(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_sim_cards_pda ON sim_cards(pda_id)',
      'CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status_id)',
      'CREATE INDEX IF NOT EXISTS idx_sim_card_history_sim_card ON sim_card_history(sim_card_id)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await db.query(indexQuery);
      } catch (error) {
        // Index might already exist, continue
        console.log(`ℹ️  Index already exists or couldn't be created: ${error.message}`);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addMissingColumns()
    .then(() => {
      console.log('🎉 Database migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addMissingColumns;