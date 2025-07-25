const db = require('../src/config/db');

async function createHistoryTable() {
  try {
    console.log('Creating item_history table if it doesn\'t exist...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS item_history (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id),
        action_type VARCHAR(50) NOT NULL,
        action_details JSONB,
        performed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_item_history_item ON item_history(item_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_item_history_action ON item_history(action_type);
    `);

    console.log('Item history table created/verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error with item_history table:', error);
    process.exit(1);
  }
}

createHistoryTable();
