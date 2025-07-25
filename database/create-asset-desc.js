// Add this function to your init-db.js file or run as a separate migration
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function addDescriptionColumn(pool) {
	console.log('Adding description column to items table...');
	const client = await pool.connect();
	try {
	  // Check if the description column already exists
	  const columnCheck = await client.query(`
		SELECT column_name
		FROM information_schema.columns
		WHERE table_name = 'items' AND column_name = 'description';
	  `);

	  if (columnCheck.rows.length === 0) {
		// Add the description column
		await client.query(`
		  ALTER TABLE items ADD COLUMN description TEXT;
		`);
		console.log('Added description column to items table');
	  } else {
		console.log('Description column already exists in items table');
	  }
	} catch (error) {
	  console.error('Error adding description column:', error);
	}
  }


  module.exports = { addDescriptionColumn };

  addDescriptionColumn(pool);
