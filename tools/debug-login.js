/**
 * Login Debugging Tool
 * Helps identify issues with authentication
 */
require('dotenv').config();
const db = require('../src/config/db');
const bcrypt = require('bcrypt');

async function debugLogin() {
  try {
    console.log('===== Login Debug Tool =====');
    console.log('Checking database connection...');
    await db.query('SELECT 1'); // Test database connection
    console.log('✓ Database connection successful');

    // Check if admin user exists
    console.log('\nChecking for admin user...');
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', ['admin@example.com']);

    if (rows.length === 0) {
      console.log('✗ Admin user not found in database');
      console.log('\nCreating admin user...');

      // Create admin user
      const hashedPassword = await bcrypt.hash('admin', 10);
      await db.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Administrator', 'admin@example.com', hashedPassword, 'admin']
      );
      console.log('✓ Admin user created successfully');
      console.log('   Username: admin@example.com');
      console.log('   Password: admin');
    } else {
      console.log('✓ Admin user found in database');
      console.log(`   User ID: ${rows[0].id}`);
      console.log(`   Name: ${rows[0].name}`);
      console.log(`   Email: ${rows[0].email}`);
      console.log(`   Role: ${rows[0].role}`);

      // Reset admin password
      console.log('\nResetting admin password...');
      const hashedPassword = await bcrypt.hash('admin', 10);
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, 'admin@example.com']);
      console.log('✓ Password reset successfully');
      console.log('   New password: admin');
    }

    console.log('\nVerifying session configuration...');
    // Check if session secret is configured
    if (!process.env.SESSION_SECRET) {
      console.log('✗ SESSION_SECRET not found in .env file');
      console.log('  This can cause session issues. Add a SESSION_SECRET to your .env file.');
    } else {
      console.log('✓ SESSION_SECRET is configured');
    }

    console.log('\nDebugging completed successfully.');
  } catch (error) {
    console.error('\nError during debugging:');
    console.error(error);
  } finally {
    // Close the database connection
    await db.end();
    process.exit(0);
  }
}

debugLogin();
