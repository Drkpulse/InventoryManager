/**
 * Reset Admin User
 * Creates or resets the admin user with a default password
 */
require('dotenv').config();
const db = require('../src/config/db');
const bcrypt = require('bcrypt');

async function resetAdmin() {
  try {
    console.log('===== User Reset Tool =====');

    // Hash the password
    const hashedPassword = await bcrypt.hash('user123', 10);

    // Check if admin exists
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', ['user@example.com']);

    if (rows.length === 0) {
      // Admin doesn't exist, create it
      console.log('Creating new user...');

      await db.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        ['Regular User', 'user@example.com', hashedPassword, 'user']
      );

      console.log('User created successfully.');
    } else {
      // Admin exists, update password
      console.log('Resetting user password...');

      await db.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, 'user@example.com']
      );

      console.log('User password reset successfully.');
    }

    console.log('\nAdmin login details:');
    console.log('  Email: admin@example.com');
    console.log('  Password: admin');
    console.log('\nReset completed.');
  } catch (error) {
    console.error('Error resetting admin:', error);
  } finally {
    // Check if the db object has a pool property with an end method
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
    // Or check if db has a client property with an end method
    else if (db.client && typeof db.client.end === 'function') {
      await db.client.end();
    }
    // Otherwise, log that we couldn't close the connection
    else {
      console.log('Note: Could not close database connection automatically.');
    }
  }
}

resetAdmin();
