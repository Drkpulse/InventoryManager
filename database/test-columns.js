#!/usr/bin/env node

/**
 * Test Database Columns
 * Quick test to verify all required columns exist
 */

const db = require('../src/config/db');

async function testColumns() {
  console.log('🧪 Testing Database Columns');
  console.log('===========================');

  try {
    // Test database connection
    console.log('🔌 Testing connection...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Test departments.description
    console.log('\n📝 Testing departments.description column...');
    try {
      const result = await db.query('SELECT id, name, description FROM departments LIMIT 1');
      console.log('✅ departments.description column accessible');
      console.log(`   Found ${result.rows.length} department(s)`);
    } catch (error) {
      console.log('❌ departments.description column error:', error.message);
    }

    // Test license_config.status
    console.log('\n🔐 Testing license_config.status column...');
    try {
      const result = await db.query('SELECT id, status, company FROM license_config LIMIT 1');
      console.log('✅ license_config.status column accessible');
      console.log(`   Found ${result.rows.length} license(s)`);
      if (result.rows.length > 0) {
        console.log(`   Status: ${result.rows[0].status}`);
      }
    } catch (error) {
      console.log('❌ license_config.status column error:', error.message);
    }

    // Test users lockout columns
    console.log('\n👤 Testing users lockout columns...');
    try {
      const result = await db.query('SELECT id, login_attempts, locked_until FROM users LIMIT 1');
      console.log('✅ users lockout columns accessible');
      console.log(`   Found ${result.rows.length} user(s)`);
    } catch (error) {
      console.log('❌ users lockout columns error:', error.message);
    }

    console.log('\n🎯 Column Test Summary:');
    console.log('======================');
    console.log('Run this test after applying the database fix to verify all columns exist.');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Make sure your database is running and environment variables are set');
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  testColumns();
}

module.exports = { testColumns };
