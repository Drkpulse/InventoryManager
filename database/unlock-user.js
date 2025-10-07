#!/usr/bin/env node

/**
 * User Account Unlock Utility
 * Usage: node tools/unlock-user.js <username_or_email>
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function unlockUser(loginInput) {
  try {
    if (!loginInput) {
      console.error('❌ Please provide a username, email, or CEP ID');
      console.log('Usage: node tools/unlock-user.js <username_or_email>');
      process.exit(1);
    }

    // Find user
    const { rows } = await pool.query('SELECT * FROM find_user_by_login($1)', [loginInput]);

    if (rows.length === 0) {
      console.error(`❌ User not found: ${loginInput}`);
      process.exit(1);
    }

    const user = rows[0];

    // Check if user is locked
    if (!user.account_locked) {
      console.log(`✅ User ${user.name} (${user.email}) is not locked`);
      process.exit(0);
    }

    // Unlock the user
    await pool.query(
      'UPDATE users SET account_locked = FALSE, failed_login_attempts = 0, locked_until = NULL, locked_at = NULL WHERE id = $1',
      [user.id]
    );

    console.log(`✅ Successfully unlocked user: ${user.name} (${user.email})`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🆔 CEP ID: ${user.cep_id}`);
    console.log(`🔓 Failed attempts reset to 0`);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get command line argument
const loginInput = process.argv[2];
unlockUser(loginInput);
