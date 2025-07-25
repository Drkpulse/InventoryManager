const db = require('../src/config/db');

async function addSettingsColumn() {
  try {
    console.log('Adding settings column to users table if it doesn\'t exist...');

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
    `);

    console.log('Settings column added or already exists');

    // Set default settings for all users
    await db.query(`
      UPDATE users
      SET settings = jsonb_build_object(
        'theme', 'light',
        'language', 'en'
      )
      WHERE settings IS NULL OR settings = '{}'::jsonb;
    `);

    console.log('Default settings added to users');
    process.exit(0);
  } catch (error) {
    console.error('Error with settings column:', error);
    process.exit(1);
  }
}

addSettingsColumn();
