#!/usr/bin/env node

/**
 * Quick Database Fix for Missing Columns
 * This script specifically fixes the missing columns that are causing errors
 */

const db = require('../src/config/db');

async function fixMissingColumns() {
  console.log('🔧 Quick Database Column Fix');
  console.log('============================');

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Fix 1: Add description column to departments table
    console.log('\n📝 Adding description column to departments table...');
    try {
      await db.query(`
        ALTER TABLE departments
        ADD COLUMN IF NOT EXISTS description TEXT
      `);
      console.log('✅ departments.description column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  departments.description column already exists');
      } else {
        console.error('❌ Error adding departments.description:', error.message);
      }
    }

    // Fix 2: Ensure license_config table has status column
    console.log('\n🔐 Checking license_config table structure...');
    try {
      // Check if status column exists
      const statusCheck = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'license_config' AND column_name = 'status'
      `);

      if (statusCheck.rows.length === 0) {
        console.log('Adding status column to license_config...');
        await db.query(`
          ALTER TABLE license_config
          ADD COLUMN status VARCHAR(50) DEFAULT 'active'
        `);
        console.log('✅ license_config.status column added');
      } else {
        console.log('ℹ️  license_config.status column already exists');
      }

      // Ensure other required columns exist
      const requiredColumns = [
        { name: 'last_checked', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
        { name: 'validation_attempts', type: 'INTEGER', default: '0' }
      ];

      for (const col of requiredColumns) {
        const check = await db.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'license_config' AND column_name = $1
        `, [col.name]);

        if (check.rows.length === 0) {
          console.log(`Adding ${col.name} column to license_config...`);
          await db.query(`
            ALTER TABLE license_config
            ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}
          `);
          console.log(`✅ license_config.${col.name} column added`);
        } else {
          console.log(`ℹ️  license_config.${col.name} column already exists`);
        }
      }
    } catch (error) {
      console.error('❌ Error fixing license_config table:', error.message);
    }

    // Fix 3: Add user lockout columns if missing
    console.log('\n👤 Checking users table for lockout columns...');
    try {
      const lockoutColumns = [
        { name: 'login_attempts', type: 'INTEGER', default: '0' },
        { name: 'locked_until', type: 'TIMESTAMP', default: 'NULL' },
        { name: 'last_failed_login', type: 'TIMESTAMP', default: 'NULL' }
      ];

      for (const col of lockoutColumns) {
        const check = await db.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = $1
        `, [col.name]);

        if (check.rows.length === 0) {
          console.log(`Adding ${col.name} column to users...`);
          await db.query(`
            ALTER TABLE users
            ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}
          `);
          console.log(`✅ users.${col.name} column added`);
        } else {
          console.log(`ℹ️  users.${col.name} column already exists`);
        }
      }
    } catch (error) {
      console.error('❌ Error adding user lockout columns:', error.message);
    }

    // Verification
    console.log('\n🔍 Verifying fixes...');

    const verifications = [
      {
        name: 'departments.description',
        query: `SELECT column_name FROM information_schema.columns
                WHERE table_name = 'departments' AND column_name = 'description'`
      },
      {
        name: 'license_config.status',
        query: `SELECT column_name FROM information_schema.columns
                WHERE table_name = 'license_config' AND column_name = 'status'`
      }
    ];

    let allFixed = true;
    for (const verification of verifications) {
      try {
        const result = await db.query(verification.query);
        if (result.rows.length > 0) {
          console.log(`✅ ${verification.name} - Fixed`);
        } else {
          console.log(`❌ ${verification.name} - Still missing`);
          allFixed = false;
        }
      } catch (error) {
        console.log(`❌ ${verification.name} - Error checking: ${error.message}`);
        allFixed = false;
      }
    }

    console.log('\n🎉 Database Fix Complete!');
    console.log('=========================');
    if (allFixed) {
      console.log('✅ All critical columns have been added');
      console.log('🚀 Your application should now work without column errors');
    } else {
      console.log('⚠️  Some columns may still be missing');
      console.log('💡 Check the error messages above for details');
    }

    process.exit(allFixed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Database fix failed:', error);
    console.error('💡 Make sure your database is running and accessible');
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixMissingColumns();
}

module.exports = { fixMissingColumns };
