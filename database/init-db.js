const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initializeDatabase() {
  // First connect to the default 'postgres' database
  const mainPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres', // Connect to default database
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  let mainClient = null;

  try {
    // Connect to main postgres database
    mainClient = await mainPool.connect();

    // Check if our target database exists
    const checkDb = await mainClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    // Create database if it doesn't exist
    if (checkDb.rowCount === 0) {
      console.log(`Creating database: ${process.env.DB_NAME}`);
      await mainClient.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database ${process.env.DB_NAME} created successfully`);
    } else {
      console.log(`Database ${process.env.DB_NAME} already exists`);
    }

    // Close connection to main postgres database
    mainClient.release();
    await mainPool.end();

    // Now connect to our target database
    const dbPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    });

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    console.log('Running database schema...');
    await dbPool.query(schema);

    console.log('Database initialization completed successfully');
    await dbPool.end();

  } catch (err) {
    console.error('Database initialization failed:', err);
    if (mainClient) {
      mainClient.release();
    }
    process.exit(1);
  }
}

initializeDatabase();
