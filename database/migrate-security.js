#!/usr/bin/env node
/**
 * Security Enhancement Migration Script
 * Applies all security-related database changes and configurations
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use the new secure database module
const db = require('../src/config/secureDb');

const migrationFiles = [
  'security_tables_ordered.sql'
];

async function runSecurityMigrations() {
  console.log('🔐 Starting security enhancements migration...\n');

  try {
    // Check database connection
    console.log('📡 Testing database connection...');
    const health = await db.healthCheck();
    if (health.status === 'error') {
      throw new Error(`Database connection failed: ${health.error}`);
    }
    console.log('✅ Database connection successful\n');

    // Run each migration file
    for (const migrationFile of migrationFiles) {
      const filePath = path.join(__dirname, migrationFile);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Migration file not found: ${migrationFile}`);
        continue;
      }

      console.log(`📄 Running migration: ${migrationFile}`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Split by semicolons and execute each statement
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length === 0) continue;

        try {
          await db.query(statement);
          console.log(`  ✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          // Some statements might fail if objects already exist - that's OK
          if (error.message.includes('already exists') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`  ⚠️ Statement ${i + 1} skipped (object already exists)`);
          } else {
            console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
      console.log(`✅ Migration ${migrationFile} completed\n`);
    }

    // Verify security tables
    console.log('🔍 Verifying security table installation...');
    const securityTables = [
      'login_attempts',
      'account_lockouts',
      'security_events',
      'password_history',
      'user_sessions',
      'csrf_tokens',
      'rate_limits',
      'file_uploads'
    ];

    for (const tableName of securityTables) {
      try {
        const result = await db.query(`
          SELECT COUNT(*) as exists
          FROM information_schema.tables
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);

        if (parseInt(result.rows[0].exists) > 0) {
          console.log(`  ✅ Table '${tableName}' exists`);
        } else {
          console.log(`  ❌ Table '${tableName}' missing`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking table '${tableName}':`, error.message);
      }
    }

    // Add security indexes if they don't exist
    console.log('\n🚀 Creating additional security indexes...');
    const securityIndexes = [
      {
        name: 'idx_users_security_lookup',
        sql: 'CREATE INDEX IF NOT EXISTS idx_users_security_lookup ON users(email, active, failed_login_attempts)'
      },
      {
        name: 'idx_security_events_monitoring',
        sql: 'CREATE INDEX IF NOT EXISTS idx_security_events_monitoring ON security_events(event_type, severity, created_at)'
      },
      {
        name: 'idx_login_attempts_security',
        sql: 'CREATE INDEX IF NOT EXISTS idx_login_attempts_security ON login_attempts(ip_address, identifier, attempt_time, attempt_type)'
      }
    ];

    for (const index of securityIndexes) {
      try {
        await db.query(index.sql);
        console.log(`  ✅ Index '${index.name}' created`);
      } catch (error) {
        console.log(`  ⚠️ Index '${index.name}' already exists or failed:`, error.message);
      }
    }

    // Check for admin user and warn if using default password
    console.log('\n👤 Checking admin account security...');
    const adminCheck = await db.query(`
      SELECT id, name, email, cep_id,
             failed_login_attempts, account_locked,
             last_login, created_at
      FROM users
      WHERE role = 'admin' OR id = 1
      ORDER BY id LIMIT 1
    `);

    if (adminCheck.rows.length > 0) {
      const admin = adminCheck.rows[0];
      console.log(`  👤 Admin user found: ${admin.name} (${admin.email})`);
      console.log(`  📅 Created: ${admin.created_at}`);
      console.log(`  📅 Last login: ${admin.last_login || 'Never'}`);
      console.log(`  🔒 Failed attempts: ${admin.failed_login_attempts}`);
      console.log(`  🔐 Account locked: ${admin.account_locked ? 'Yes' : 'No'}`);

      console.log('\n⚠️  SECURITY WARNING:');
      console.log('   Please ensure you have changed the default admin password!');
      console.log('   Default credentials should NEVER be used in production.');
    }

    // Run cleanup to remove any old data
    console.log('\n🧹 Running security table cleanup...');
    await db.query('SELECT cleanup_security_tables()');
    console.log('  ✅ Cleanup completed');

    console.log('\n🎉 Security enhancements migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Review the SECURITY.md file for configuration details');
    console.log('   2. Update your .env file with secure values');
    console.log('   3. Test all authentication and authorization features');
    console.log('   4. Monitor security logs regularly');
    console.log('   5. Set up automated security table cleanup');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await db.shutdown();
  }
}

// Main execution
if (require.main === module) {
  runSecurityMigrations().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runSecurityMigrations };
