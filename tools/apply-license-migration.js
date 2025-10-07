#!/usr/bin/env node

/**
 * Apply License Database Migration
 * Executes the license database migration against the actual database
 */

const fs = require('fs');
const path = require('path');

async function applyLicenseMigration() {
  console.log('🚀 Applying License Database Migration');
  console.log('=' .repeat(50));

  try {
    // Import database configuration
    const dbConfig = require('../src/config/db');

    console.log('📊 Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/002_validate_license_database.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📝 Loaded migration file (${(migrationSQL.length / 1024).toFixed(2)} KB)`);

    // Execute the migration
    console.log('⚡ Executing migration...');
    await dbConfig.query(migrationSQL);
    console.log('✅ Migration executed successfully');

    // Validate the migration results
    console.log('\n🔍 Validating migration results...');

    // Test the validation function
    const validationResult = await dbConfig.query('SELECT * FROM validate_license_data()');
    const validation = validationResult.rows[0];

    console.log('📊 License Validation Results:');
    console.log(`   Status: ${validation.validation_result}`);
    console.log(`   Total Licenses: ${validation.license_count}`);
    console.log(`   Active Licenses: ${validation.active_licenses}`);
    console.log(`   Expired Licenses: ${validation.expired_licenses}`);

    if (validation.issues_found && validation.issues_found.length > 0) {
      console.log('⚠️  Issues Found:');
      validation.issues_found.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }

    // Test the statistics function
    const statsResult = await dbConfig.query('SELECT * FROM get_license_statistics()');
    const stats = statsResult.rows[0];

    console.log('\n📈 License Statistics:');
    console.log(`   Total Licenses: ${stats.total_licenses}`);
    console.log(`   Active Licenses: ${stats.active_licenses}`);
    console.log(`   Expired Licenses: ${stats.expired_licenses}`);
    console.log(`   Invalid Licenses: ${stats.invalid_licenses}`);

    if (stats.current_license_company) {
      console.log(`   Current Company: ${stats.current_license_company}`);
      console.log(`   Valid Until: ${stats.current_license_valid_until}`);
      console.log(`   Days Until Expiry: ${stats.days_until_expiry}`);
    }

    // Test the dashboard view
    const dashboardResult = await dbConfig.query('SELECT COUNT(*) as view_count FROM license_dashboard_view');
    console.log(`📊 License Dashboard View: ${dashboardResult.rows[0].view_count} records accessible`);

    console.log('\n✅ License database migration completed successfully!');

    // Check if auto-run migrations is working
    console.log('\n🔄 Testing automatic migration system...');
    const runMigrations = require('../database/init-db').runMigrations;
    if (typeof runMigrations === 'function') {
      console.log('✅ Automatic migration system is available');
      console.log('   Migration will run automatically on Docker startup');
    } else {
      console.log('⚠️  Automatic migration system not found');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { applyLicenseMigration };

// Run if called directly
if (require.main === module) {
  applyLicenseMigration().catch(error => {
    console.error('❌ Failed to apply license migration:', error);
    process.exit(1);
  });
}
