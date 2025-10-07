#!/usr/bin/env node

// Apply login attempts migration to add account locking functionality
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function applyLoginAttemptsMigration() {
  console.log('🔄 Applying login attempts migration...');

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'database', 'add-login-attempts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded from:', migrationPath);

    // Execute the migration
    await db.query(migrationSQL);

    console.log('✅ Login attempts migration applied successfully!');

    // Verify the migration by checking if columns exist
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('failed_login_attempts', 'account_locked', 'locked_at', 'locked_until')
      ORDER BY column_name
    `);

    console.log('📊 Verified columns added:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check if functions were created
    const functions = await db.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_name IN (
        'handle_failed_login_attempt',
        'handle_successful_login',
        'unlock_user_account',
        'is_account_locked'
      )
      AND routine_schema = 'public'
      ORDER BY routine_name
    `);

    console.log('📋 Functions created:');
    functions.rows.forEach(func => {
      console.log(`  - ${func.routine_name} (${func.routine_type})`);
    });

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run the migration
applyLoginAttemptsMigration();
