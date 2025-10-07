#!/usr/bin/env node

/**
 * Complete Migration Runner
 * This script runs all pending database migrations
 */

const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

// Migration tracking table
async function createMigrationsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `);
    console.log('✅ Migrations tracking table ready');
  } catch (error) {
    console.error('❌ Error creating migrations table:', error);
    throw error;
  }
}

// Check if migration has been run
async function isMigrationExecuted(migrationName) {
  try {
    const result = await db.query(
      'SELECT id FROM schema_migrations WHERE migration_name = $1',
      [migrationName]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking migration ${migrationName}:`, error);
    return false;
  }
}

// Mark migration as executed
async function markMigrationExecuted(migrationName, description = '') {
  try {
    await db.query(
      `INSERT INTO schema_migrations (migration_name, description, executed_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (migration_name) DO UPDATE SET
       executed_at = CURRENT_TIMESTAMP, description = $2`,
      [migrationName, description]
    );
    console.log(`✅ Marked migration ${migrationName} as executed`);
  } catch (error) {
    console.error(`Error marking migration ${migrationName}:`, error);
  }
}

// Execute SQL file
async function executeSQLFile(filePath, migrationName) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`📄 Executing ${migrationName}...`);
    await db.query(sql);
    console.log(`✅ ${migrationName} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error executing ${migrationName}:`, error.message);
    return false;
  }
}

// Run individual migrations
async function runMigration001() {
  const migrationName = '001_add_user_lockout_fields';
  if (await isMigrationExecuted(migrationName)) {
    console.log(`⏭️  Skipping ${migrationName} (already executed)`);
    return true;
  }

  try {
    console.log(`🔧 Running ${migrationName}...`);

    // Add lockout fields to users table
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP NULL
    `);

    await markMigrationExecuted(migrationName, 'Added user account lockout fields');
    return true;
  } catch (error) {
    console.error(`❌ Failed ${migrationName}:`, error);
    return false;
  }
}

async function runMigration002() {
  const migrationName = '002_validate_license_database';
  if (await isMigrationExecuted(migrationName)) {
    console.log(`⏭️  Skipping ${migrationName} (already executed)`);
    return true;
  }

  const sqlPath = path.join(__dirname, 'migrations', '002_validate_license_database.sql');
  const success = await executeSQLFile(sqlPath, migrationName);
  if (success) {
    await markMigrationExecuted(migrationName, 'Validated license_config table structure and added integrity functions');
  }
  return success;
}

async function runMigration003() {
  const migrationName = '003_add_department_description';
  if (await isMigrationExecuted(migrationName)) {
    console.log(`⏭️  Skipping ${migrationName} (already executed)`);
    return true;
  }

  const sqlPath = path.join(__dirname, 'migrations', '003_add_department_description.sql');
  const success = await executeSQLFile(sqlPath, migrationName);
  if (success) {
    await markMigrationExecuted(migrationName, 'Added description field to departments table');
  }
  return success;
}

async function runMigration006() {
  const migrationName = '006_ensure_license_config';
  if (await isMigrationExecuted(migrationName)) {
    console.log(`⏭️  Skipping ${migrationName} (already executed)`);
    return true;
  }

  const sqlPath = path.join(__dirname, 'migrations', '006_ensure_license_config.sql');
  const success = await executeSQLFile(sqlPath, migrationName);
  if (success) {
    await markMigrationExecuted(migrationName, 'Ensured license_config table exists with all required columns and bypass license');
  }
  return success;
}

// Verify critical tables and columns exist
async function verifyDatabaseStructure() {
  console.log('\n🔍 Verifying database structure...');

  const checks = [
    {
      name: 'departments.description column',
      query: `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'departments' AND column_name = 'description'`
    },
    {
      name: 'license_config table exists',
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_name = 'license_config'`
    },
    {
      name: 'license_config.status column',
      query: `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'license_config' AND column_name = 'status'`
    },
    {
      name: 'license_config.features column',
      query: `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'license_config' AND column_name = 'features'`
    },
    {
      name: 'users.login_attempts column',
      query: `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'users' AND column_name = 'login_attempts'`
    },
    {
      name: 'bypass license exists',
      query: `SELECT license_key FROM license_config
              WHERE license_key = 'iambeirao' LIMIT 1`
    }
  ];

  let allGood = true;
  for (const check of checks) {
    try {
      const result = await db.query(check.query);
      if (result.rows.length > 0) {
        console.log(`✅ ${check.name} exists`);
      } else {
        console.log(`❌ ${check.name} missing`);
        allGood = false;
      }
    } catch (error) {
      console.log(`❌ Error checking ${check.name}:`, error.message);
      allGood = false;
    }
  }

  return allGood;
}

// Main migration runner
async function runAllMigrations() {
  console.log('🚀 Starting Database Migration Runner');
  console.log('=====================================');

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Create migrations table
    await createMigrationsTable();

    // Run migrations in order
    const migrations = [
      { name: '001', runner: runMigration001 },
      { name: '002', runner: runMigration002 },
      { name: '003', runner: runMigration003 },
      { name: '006', runner: runMigration006 }
    ];

    let successCount = 0;
    for (const migration of migrations) {
      console.log(`\n📋 Processing Migration ${migration.name}...`);
      const success = await migration.runner();
      if (success) {
        successCount++;
      } else {
        console.error(`❌ Migration ${migration.name} failed - stopping`);
        break;
      }
    }

    console.log(`\n📊 Migration Results: ${successCount}/${migrations.length} completed`);

    // Verify structure
    const structureValid = await verifyDatabaseStructure();

    console.log('\n🎉 Migration Summary:');
    console.log('====================');
    console.log(`Migrations completed: ${successCount}/${migrations.length}`);
    console.log(`Database structure: ${structureValid ? '✅ Valid' : '❌ Issues found'}`);

    if (structureValid) {
      console.log('\n✅ All migrations completed successfully!');
      console.log('🚀 Your database is ready to use.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some database structure issues remain.');
      console.log('💡 Please check the error messages above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  }
}

// Show migration status
async function showMigrationStatus() {
  try {
    console.log('📋 Current Migration Status');
    console.log('==========================');

    await createMigrationsTable();

    const result = await db.query(`
      SELECT migration_name, executed_at, description
      FROM schema_migrations
      ORDER BY executed_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('No migrations have been executed yet.');
    } else {
      result.rows.forEach(row => {
        console.log(`✅ ${row.migration_name} - ${row.executed_at.toISOString()} - ${row.description}`);
      });
    }

    await verifyDatabaseStructure();

  } catch (error) {
    console.error('Error getting migration status:', error);
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'status':
      showMigrationStatus().then(() => process.exit(0));
      break;
    case 'run':
    default:
      runAllMigrations();
      break;
  }
}

module.exports = {
  runAllMigrations,
  showMigrationStatus
};
