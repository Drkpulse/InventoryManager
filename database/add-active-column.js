const db = require('../src/config/db');

async function addActiveColumn() {
  try {
    console.log('Adding active column to users table...');

    // Check if column already exists
    const result = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'active'
    `);

    if (result.rows.length === 0) {
      await db.query(`
        ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE
      `);
      console.log('Active column added successfully');

      // Update all existing users to be active
      await db.query(`UPDATE users SET active = TRUE WHERE active IS NULL`);
      console.log('Updated existing users to active status');
    } else {
      console.log('Active column already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error adding active column:', error);
    process.exit(1);
  }
}

addActiveColumn();
