#!/usr/bin/env node

/**
 * License Database Fix Script
 * This script ensures the license system works properly, especially for the "iambeirao" bypass license
 */

const db = require('../src/config/db');

async function createLicenseConfigTable() {
  console.log('🔧 Creating/updating license_config table...');

  try {
    // Create the table with all required columns
    await db.query(`
      CREATE TABLE IF NOT EXISTS license_config (
        id SERIAL PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        valid_until TIMESTAMP,
        issued_to VARCHAR(255),
        features JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validation_attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Base license_config table created');

    // Add missing columns (safe operations)
    const columns = [
      { name: 'status', type: 'VARCHAR(50)', default: "'active'" },
      { name: 'last_checked', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
      { name: 'validation_attempts', type: 'INTEGER', default: '0' },
      { name: 'features', type: 'JSONB', default: "'{}'" },
      { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
      { name: 'issued_to', type: 'VARCHAR(255)', default: 'NULL' }
    ];

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE license_config
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}
        `);
        console.log(`✅ Ensured column ${col.name} exists`);
      } catch (error) {
        console.log(`ℹ️  Column ${col.name} might already exist`);
      }
    }

    // Add unique constraint on license_key (ignore if exists)
    try {
      await db.query(`
        ALTER TABLE license_config
        ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key)
      `);
      console.log('✅ Added unique constraint on license_key');
    } catch (error) {
      console.log('ℹ️  License key unique constraint might already exist');
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating license table:', error);
    return false;
  }
}

async function ensureBypassLicense() {
  console.log('🔧 Ensuring bypass license exists...');

  try {
    // Insert or update the bypass license
    await db.query(`
      INSERT INTO license_config (license_key, company, valid_until, status, features)
      VALUES (
        'iambeirao',
        'Test Company',
        $1,
        'active',
        $2
      ) ON CONFLICT (license_key) DO UPDATE SET
        company = 'Test Company',
        valid_until = $1,
        status = 'active',
        features = $2,
        last_checked = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      JSON.stringify({ bypass: true, testing: true })
    ]);

    console.log('✅ Bypass license "iambeirao" is configured and active');
    return true;
  } catch (error) {
    console.error('❌ Error configuring bypass license:', error);
    return false;
  }
}

async function testLicenseOperations() {
  console.log('🔍 Testing license operations...');

  try {
    // Test reading licenses
    const licenses = await db.query('SELECT * FROM license_config ORDER BY created_at DESC');
    console.log(`✅ Found ${licenses.rows.length} license(s) in database`);

    // Test the bypass license specifically
    const bypassLicense = await db.query('SELECT * FROM license_config WHERE license_key = $1', ['iambeirao']);

    if (bypassLicense.rows.length > 0) {
      const license = bypassLicense.rows[0];
      console.log('✅ Bypass license found:');
      console.log(`   - Company: ${license.company}`);
      console.log(`   - Status: ${license.status}`);
      console.log(`   - Valid until: ${license.valid_until}`);
      console.log(`   - Features: ${JSON.stringify(license.features)}`);
    } else {
      console.log('❌ Bypass license not found');
      return false;
    }

    // Test updating license
    await db.query(`
      UPDATE license_config
      SET last_checked = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE license_key = 'iambeirao'
    `);
    console.log('✅ License update operation successful');

    return true;
  } catch (error) {
    console.error('❌ Error testing license operations:', error);
    return false;
  }
}

async function verifyLicenseSystem() {
  console.log('🔍 Verifying complete license system...');

  try {
    // Import and test the LicenseValidator
    const { licenseValidator } = require('../src/middleware/licenseValidator');

    // Test license validation with bypass
    console.log('🔧 Testing license validation with bypass key...');
    const result = await licenseValidator.validateLicense('iambeirao');

    if (result.status === 'active') {
      console.log('✅ License validation works correctly');
      console.log(`   - Status: ${result.status}`);
      console.log(`   - Company: ${result.company}`);
      console.log(`   - Message: ${result.msg}`);
    } else {
      console.log('❌ License validation failed:', result);
      return false;
    }

    // Test license check
    console.log('🔧 Testing license check...');
    const checkResult = await licenseValidator.checkLicense();

    if (checkResult.status === 'active' || checkResult.status === 'missing') {
      console.log('✅ License check works correctly');
      console.log(`   - Status: ${checkResult.status}`);
    } else {
      console.log('❌ License check failed:', checkResult);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error verifying license system:', error);
    return false;
  }
}

async function fixLicenseSystem() {
  console.log('🚀 Starting License System Fix');
  console.log('===============================');

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Step 1: Create/update license table
    const tableCreated = await createLicenseConfigTable();
    if (!tableCreated) {
      throw new Error('Failed to create license table');
    }

    // Step 2: Ensure bypass license exists
    const bypassConfigured = await ensureBypassLicense();
    if (!bypassConfigured) {
      throw new Error('Failed to configure bypass license');
    }

    // Step 3: Test license operations
    const operationsWork = await testLicenseOperations();
    if (!operationsWork) {
      throw new Error('License operations test failed');
    }

    // Step 4: Verify complete system
    const systemWorks = await verifyLicenseSystem();
    if (!systemWorks) {
      throw new Error('License system verification failed');
    }

    console.log('\n🎉 License System Fix Summary:');
    console.log('==============================');
    console.log('✅ License table created/updated');
    console.log('✅ Bypass license "iambeirao" configured');
    console.log('✅ Database operations working');
    console.log('✅ License validation working');
    console.log('\n💡 The license system is now fully functional!');
    console.log('💡 You can use "iambeirao" as a bypass license key.');

  } catch (error) {
    console.error('\n❌ License system fix failed:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Ensure the database is running and accessible');
    console.log('2. Check database connection settings in .env file');
    console.log('3. Verify database user has CREATE/ALTER permissions');
    console.log('4. Run the database initialization script: npm run init-db');
  }
}

// Show current license status
async function showLicenseStatus() {
  try {
    console.log('📋 Current License Status');
    console.log('========================');

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'license_config'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ license_config table does not exist');
      return;
    }

    // Get all licenses
    const licenses = await db.query('SELECT * FROM license_config ORDER BY created_at DESC');

    if (licenses.rows.length === 0) {
      console.log('ℹ️  No licenses configured');
    } else {
      licenses.rows.forEach((license, index) => {
        console.log(`\nLicense ${index + 1}:`);
        console.log(`   Key: ${license.license_key}`);
        console.log(`   Company: ${license.company || 'Not set'}`);
        console.log(`   Status: ${license.status}`);
        console.log(`   Valid until: ${license.valid_until || 'No expiry'}`);
        console.log(`   Last checked: ${license.last_checked || 'Never'}`);
        console.log(`   Features: ${JSON.stringify(license.features || {})}`);
      });
    }

  } catch (error) {
    console.error('Error getting license status:', error);
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'status':
      showLicenseStatus().then(() => process.exit(0));
      break;
    case 'fix':
    default:
      fixLicenseSystem().then(() => process.exit(0));
      break;
  }
}

module.exports = {
  fixLicenseSystem,
  showLicenseStatus,
  createLicenseConfigTable,
  ensureBypassLicense,
  testLicenseOperations,
  verifyLicenseSystem
};
