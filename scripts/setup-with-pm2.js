const { Pool } = require('pg');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default database first
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
};

async function setupDatabase() {
  const pool = new Pool(dbConfig);

  try {
    console.log('🔍 Checking database connection...');

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if our database exists
    const dbName = process.env.DB_NAME || 'inventory_db';
    const result = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`📦 Creating database ${dbName}...`);
      await pool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database ${dbName} created`);
    } else {
      console.log(`✅ Database ${dbName} already exists`);
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing database schema...');
    await execAsync('npm run init-db');
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

async function startPM2() {
  try {
    console.log('🚀 Starting application with PM2...');

    // Stop any existing instances
    try {
      await execAsync('pm2 delete it-asset-manager');
    } catch (e) {
      // Ignore if app doesn't exist
    }

    // Start the application
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    await execAsync(`pm2 start ecosystem.config.js --env ${env}`);

    console.log('✅ Application started with PM2');

    // Show status
    const { stdout } = await execAsync('pm2 status');
    console.log(stdout);

  } catch (error) {
    console.error('❌ PM2 startup failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await setupDatabase();
    await initializeDatabase();
    await startPM2();

    console.log('🎉 Setup completed successfully!');
    console.log('📊 Monitor with: pm2 monit');
    console.log('📋 View logs with: pm2 logs');
    console.log('🌐 Application running at: http://localhost:3000');

  } catch (error) {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupDatabase, initializeDatabase, startPM2 };
