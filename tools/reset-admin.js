const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function resetAdminPassword() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  try {
    // Generate a new hash for the admin123 password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Update the admin user's password
    const result = await pool.query(
      "UPDATE users SET password = $1 WHERE email = 'admin@example.com'",
      [hashedPassword]
    );

    if (result.rowCount > 0) {
      console.log('Admin password has been reset successfully.');
      console.log('You can now login with:');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
    } else {
      console.log('Admin user not found. Creating admin user...');

      // Insert admin user if it doesn't exist
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['Admin User', 'admin@example.com', hashedPassword, 'admin']
      );

      console.log('Admin user created successfully.');
      console.log('You can now login with:');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
    }

  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();
