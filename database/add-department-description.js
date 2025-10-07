const db = require('../src/config/db');

async function addDepartmentDescription() {
  try {
    console.log('Adding description field to departments table...');

    await db.query(`
      ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS description TEXT
    `);

    console.log('✅ Description field added to departments table successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding description field:', error);
    process.exit(1);
  }
}

addDepartmentDescription();
