#!/usr/bin/env node

// Comprehensive migration script to set up all admin features
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runComprehensiveMigration() {
  console.log('🚀 Starting comprehensive admin features migration...');
  console.log('==================================================');

  try {
    // 1. Apply login attempts migration
    console.log('📋 Step 1: Adding login attempts tracking...');

    try {
      const loginAttemptsPath = path.join(__dirname, '..', 'database', 'add-login-attempts.sql');
      if (fs.existsSync(loginAttemptsPath)) {
        const loginAttemptsSQL = fs.readFileSync(loginAttemptsPath, 'utf8');
        await db.query(loginAttemptsSQL);
        console.log('✅ Login attempts tracking added successfully');
      } else {
        console.log('⚠️  Login attempts migration file not found, skipping...');
      }
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Login attempts features already exist');
      } else {
        console.error('❌ Login attempts migration failed:', error.message);
      }
    }

    // 2. Check users table structure
    console.log('\\n📋 Step 2: Verifying users table structure...');

    const usersColumns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('📊 Users table columns:');
    usersColumns.rows.forEach(col => {
      const hasDefault = col.column_default ? ` (default: ${col.column_default})` : '';
      console.log(`  - ${col.column_name}: ${col.data_type}${hasDefault}`);
    });

    // 3. Check for essential columns and add if missing
    console.log('\\n📋 Step 3: Ensuring essential columns exist...');

    const requiredColumns = [
      'failed_login_attempts',
      'account_locked',
      'locked_at',
      'locked_until'
    ];

    const existingColumns = usersColumns.rows.map(col => col.column_name);

    for (const column of requiredColumns) {
      if (!existingColumns.includes(column)) {
        console.log(`➕ Adding missing column: ${column}`);

        let alterSQL = '';
        switch (column) {
          case 'failed_login_attempts':
            alterSQL = 'ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0';
            break;
          case 'account_locked':
            alterSQL = 'ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT false';
            break;
          case 'locked_at':
            alterSQL = 'ALTER TABLE users ADD COLUMN locked_at TIMESTAMP';
            break;
          case 'locked_until':
            alterSQL = 'ALTER TABLE users ADD COLUMN locked_until TIMESTAMP';
            break;
        }

        try {
          await db.query(alterSQL);
          console.log(`✅ Added column: ${column}`);
        } catch (error) {
          console.error(`❌ Failed to add column ${column}:`, error.message);
        }
      } else {
        console.log(`✅ Column exists: ${column}`);
      }
    }

    // 4. Test database functions
    console.log('\\n📋 Step 4: Testing database functions...');

    const functions = [
      'handle_failed_login_attempt',
      'handle_successful_login',
      'unlock_user_account',
      'is_account_locked'
    ];

    for (const funcName of functions) {
      try {
        const funcCheck = await db.query(`
          SELECT routine_name
          FROM information_schema.routines
          WHERE routine_name = $1 AND routine_schema = 'public'
        `, [funcName]);

        if (funcCheck.rows.length > 0) {
          console.log(`✅ Function exists: ${funcName}`);
        } else {
          console.log(`⚠️  Function missing: ${funcName}`);
        }
      } catch (error) {
        console.error(`❌ Error checking function ${funcName}:`, error.message);
      }
    }

    // 5. Test license functions (optional)
    console.log('\\n📋 Step 5: Testing license functions (optional)...');

    const licenseFunctions = [
      'get_license_statistics',
      'validate_license_data'
    ];

    for (const funcName of licenseFunctions) {
      try {
        const funcCheck = await db.query(`
          SELECT routine_name
          FROM information_schema.routines
          WHERE routine_name = $1 AND routine_schema = 'public'
        `, [funcName]);

        if (funcCheck.rows.length > 0) {
          console.log(`✅ License function exists: ${funcName}`);
        } else {
          console.log(`⚠️  License function missing: ${funcName} (this is optional)`);
        }
      } catch (error) {
        console.log(`⚠️  License function ${funcName} not available (this is optional)`);
      }
    }

    // 6. Check license config table
    console.log('\\n📋 Step 6: Checking license configuration...');

    try {
      const licenseCheck = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'license_config' AND table_schema = 'public'
      `);

      if (licenseCheck.rows.length > 0) {
        const licenseCount = await db.query('SELECT COUNT(*) as count FROM license_config');
        console.log(`✅ License config table exists with ${licenseCount.rows[0].count} records`);
      } else {
        console.log('⚠️  License config table not found (this is optional)');
      }
    } catch (error) {
      console.log('⚠️  License configuration not available (this is optional)');
    }

    // 7. Update existing users to have default values
    console.log('\\n📋 Step 7: Updating existing users with default values...');

    try {
      const updateResult = await db.query(`
        UPDATE users
        SET
          failed_login_attempts = COALESCE(failed_login_attempts, 0),
          account_locked = COALESCE(account_locked, false)
        WHERE failed_login_attempts IS NULL
           OR account_locked IS NULL
      `);

      console.log(`✅ Updated ${updateResult.rowCount} users with default values`);
    } catch (error) {
      console.error('❌ Failed to update users:', error.message);
    }

    // 8. Summary
    console.log('\\n==================================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('==================================================');

    const totalUsers = await db.query('SELECT COUNT(*) as count FROM users');
    const lockedUsers = await db.query('SELECT COUNT(*) as count FROM users WHERE account_locked = true');
    const usersWithAttempts = await db.query('SELECT COUNT(*) as count FROM users WHERE failed_login_attempts > 0');

    console.log(`👥 Total users: ${totalUsers.rows[0].count}`);
    console.log(`🔒 Locked accounts: ${lockedUsers.rows[0].count}`);
    console.log(`⚠️  Users with failed attempts: ${usersWithAttempts.rows[0].count}`);

    console.log('\\n🎉 Migration completed successfully!');
    console.log('\\n📋 NEXT STEPS:');
    console.log('1. Restart your application');
    console.log('2. Test admin/users page: http://localhost:3000/admin/users');
    console.log('3. Test license page: http://localhost:3000/admin/license');
    console.log('4. Try logging in with wrong password to test login attempts');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runComprehensiveMigration();
}

module.exports = { runComprehensiveMigration };
