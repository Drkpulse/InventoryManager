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

// Get all migration files from the migrations directory
function getAllMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const migrationName = file.replace('.sql', '');
        return {
          name: migrationName,
          fileName: file,
          filePath: path.join(migrationsDir, file),
          // Extract number from filename for sorting (e.g., "001" from "001_add_user_lockout.sql")
          order: parseInt(file.split('_')[0]) || 999
        };
      })
      .sort((a, b) => a.order - b.order); // Sort by migration number

    console.log(`📁 Found ${files.length} migration files`);
    return files;
  } catch (error) {
    console.error('❌ Error reading migrations directory:', error);
    return [];
  }
}

// Run a single migration file
async function runSingleMigration(migration) {
  const { name, filePath } = migration;
  
  if (await isMigrationExecuted(name)) {
    console.log(`⏭️  Skipping ${name} (already executed)`);
    return true;
  }

  try {
    console.log(`🔧 Running ${name}...`);
    
    // Handle special case for 001 migration (hardcoded SQL)
    if (name === '001_add_user_lockout_fields') {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP NULL
      `);
      await markMigrationExecuted(name, 'Added user account lockout fields');
      return true;
    }
    
    // For all other migrations, read and execute the SQL file
    const success = await executeSQLFile(filePath, name);
    if (success) {
      // Try to extract description from SQL comments
      let description = `Executed migration ${name}`;
      try {
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        const purposeMatch = sqlContent.match(/-- Purpose: (.+)/);
        if (purposeMatch) {
          description = purposeMatch[1];
        }
      } catch (error) {
        // Ignore errors reading file for description
      }
      
      await markMigrationExecuted(name, description);
    }
    return success;
  } catch (error) {
    console.error(`❌ Failed ${name}:`, error.message);
    return false;
  }
}

async function runMigration010() {
  const migrationName = '010_add_user_analytics';
  if (await isMigrationExecuted(migrationName)) {
    console.log(`⏭️  Skipping ${migrationName} (already executed)`);
    return true;
  }

  const sqlPath = path.join(__dirname, 'migrations', '010_add_user_analytics.sql');
  const success = await executeSQLFile(sqlPath, migrationName);
  if (success) {
    await markMigrationExecuted(migrationName, 'Added comprehensive user analytics and performance tracking tables');
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
      name: 'license_config.company column',
      query: `SELECT column_name FROM information_schema.columns
              WHERE table_name = 'license_config' AND column_name = 'company'`
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
    },
    {
      name: 'user_analytics_events table',
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_name = 'user_analytics_events'`
    },
    {
      name: 'page_performance_metrics table',
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_name = 'page_performance_metrics'`
    },
    {
      name: 'user_session_summary table',
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_name = 'user_session_summary'`
    },
    {
      name: 'cookie_consent_analytics table',
      query: `SELECT table_name FROM information_schema.tables
              WHERE table_name = 'cookie_consent_analytics'`
    }
  ];

  // Additional check for license_config table column issues
  const licenseConfigCheck = {
    name: 'license_config column structure',
    description: 'Checking for column conflicts in license_config table'
  };

  let allGood = true;
  for (const check of checks) {
    try {
      const result = await db.query(check.query);
      if (result.rows.length > 0) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name} missing`);
        allGood = false;
      }
    } catch (error) {
      console.log(`❌ Error checking ${check.name}:`, error.message);
      allGood = false;
    }
  }

  // Special check for duplicate columns in license_config
  try {
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'license_config' 
      AND column_name IN ('company', 'company_name')
      ORDER BY column_name
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    if (columns.includes('company_name') && columns.includes('company')) {
      console.log(`⚠️  ${licenseConfigCheck.name}: Both 'company' and 'company_name' columns exist - needs fixing`);
      allGood = false;
    } else if (columns.includes('company')) {
      console.log(`✅ ${licenseConfigCheck.name}: Correct 'company' column exists`);
    } else if (columns.includes('company_name')) {
      console.log(`⚠️  ${licenseConfigCheck.name}: Only 'company_name' column exists, 'company' needed`);
      allGood = false;
    } else {
      console.log(`❌ ${licenseConfigCheck.name}: No company column found`);
      allGood = false;
    }
  } catch (error) {
    console.log(`❌ Error checking ${licenseConfigCheck.name}:`, error.message);
    allGood = false;
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

    // Get all migration files
    const migrations = getAllMigrationFiles();
    
    if (migrations.length === 0) {
      console.log('⚠️  No migration files found in migrations directory');
      return;
    }

    console.log(`\n📋 Found migrations to process:`);
    migrations.forEach(m => {
      console.log(`   ${m.order.toString().padStart(3, '0')}: ${m.name}`);
    });

    let successCount = 0;
    let skippedCount = 0;
    
    for (const migration of migrations) {
      console.log(`\n📋 Processing Migration ${migration.name}...`);
      
      // Check if already executed
      if (await isMigrationExecuted(migration.name)) {
        console.log(`⏭️  Skipping ${migration.name} (already executed)`);
        skippedCount++;
        continue;
      }
      
      const success = await runSingleMigration(migration);
      if (success) {
        successCount++;
        console.log(`✅ ${migration.name} completed successfully`);
      } else {
        console.error(`❌ Migration ${migration.name} failed - stopping`);
        break;
      }
    }

    console.log(`\n📊 Migration Results:`);
    console.log(`   New migrations executed: ${successCount}`);
    console.log(`   Already executed: ${skippedCount}`);
    console.log(`   Total migrations: ${migrations.length}`);

    // Verify structure
    const structureValid = await verifyDatabaseStructure();

    console.log('\n🎉 Migration Summary:');
    console.log('====================');
    console.log(`Migrations processed: ${successCount + skippedCount}/${migrations.length}`);
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
