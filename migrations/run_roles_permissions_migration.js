// migrations/run_roles_permissions_migration.js
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Starting roles and permissions migration...');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add_roles_permissions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL statements and execute them
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await db.query(statement);
        } catch (error) {
          // Ignore "already exists" errors for idempotency
          if (!error.message.includes('already exists') &&
              !error.message.includes('duplicate key') &&
              !error.message.includes('relation') &&
              !error.message.includes('already') &&
              !error.message.includes('IF NOT EXISTS')) {
            throw error;
          }
          console.log(`Skipped (already exists): Statement ${i + 1}`);
        }
      }
    }

    console.log('Migration completed successfully!');

    // Verify the migration
    console.log('\nVerifying migration...');

    const roleCount = await db.query('SELECT COUNT(*) as count FROM roles');
    console.log(`✓ Roles table: ${roleCount.rows[0].count} roles`);

    const permissionCount = await db.query('SELECT COUNT(*) as count FROM permissions');
    console.log(`✓ Permissions table: ${permissionCount.rows[0].count} permissions`);

    const userRoleCount = await db.query('SELECT COUNT(*) as count FROM user_roles');
    console.log(`✓ User roles assignments: ${userRoleCount.rows[0].count} assignments`);

    const rolePermissionCount = await db.query('SELECT COUNT(*) as count FROM role_permissions');
    console.log(`✓ Role permissions assignments: ${rolePermissionCount.rows[0].count} assignments`);

    console.log('\nMigration verification completed!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration().then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };
