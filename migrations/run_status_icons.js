const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});


async function setupSafeStatusSystem() {
  const client = await pool.connect();

  try {
    console.log('🚀 Setting up safe status system...');

    // Add missing columns if they don't exist
    console.log('📝 Adding missing columns...');
    await client.query(`
      ALTER TABLE statuses
      ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'fas fa-tag'
    `);

    await client.query(`
      ALTER TABLE statuses
      ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT 'gray'
    `);

    await client.query(`
      ALTER TABLE statuses
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `);

    await client.query(`
      ALTER TABLE statuses
      ADD COLUMN IF NOT EXISTS status_order INTEGER DEFAULT 999
    `);

    // Get existing statuses to preserve them
    const existingStatuses = await client.query('SELECT id, name, description FROM statuses ORDER BY id');
    console.log(`📋 Found ${existingStatuses.rows.length} existing statuses`);

    // Define the required default statuses
    const requiredStatuses = [
      {
        name: 'New',
        description: 'Newly acquired asset, not yet assigned or deployed',
        icon: 'fas fa-star',
        color: 'blue',
        is_active: true,
        status_order: 1
      },
      {
        name: 'Available',
        description: 'Asset is ready for assignment and available for use',
        icon: 'fas fa-check-circle',
        color: 'green',
        is_active: true,
        status_order: 2
      },
      {
        name: 'Assigned',
        description: 'Asset is currently assigned to an employee',
        icon: 'fas fa-user-check',
        color: 'red',
        is_active: true,
        status_order: 3
      },
      {
        name: 'Maintenance',
        description: 'Asset is under maintenance or repair',
        icon: 'fas fa-wrench',
        color: 'yellow',
        is_active: false,
        status_order: 4
      },
      {
        name: 'Retired',
        description: 'Asset has been retired and is no longer in active use',
        icon: 'fas fa-archive',
        color: 'gray',
        is_active: false,
        status_order: 5
      }
    ];

    // Process each required status
    for (const status of requiredStatuses) {
      // Check if status with this name already exists
      const existingStatus = existingStatuses.rows.find(s =>
        s.name.toLowerCase() === status.name.toLowerCase()
      );

      if (existingStatus) {
        // Update existing status with new properties
        console.log(`🔄 Updating existing status: ${status.name}`);
        await client.query(`
          UPDATE statuses
          SET
            description = COALESCE($1, description),
            icon = $2,
            color = $3,
            is_active = $4,
            status_order = $5,
            updated_at = NOW()
          WHERE id = $6
        `, [
          status.description,
          status.icon,
          status.color,
          status.is_active,
          status.status_order,
          existingStatus.id
        ]);
      } else {
        // Create new status
        console.log(`➕ Creating new status: ${status.name}`);
        await client.query(`
          INSERT INTO statuses (name, description, icon, color, is_active, status_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          status.name,
          status.description,
          status.icon,
          status.color,
          status.is_active,
          status.status_order
        ]);
      }
    }

    // Update any existing statuses that don't have icons/colors
    console.log('🎨 Updating existing statuses with default icons and colors...');

    // Apply smart defaults based on name patterns
    const updates = [
      { pattern: 'active', icon: 'fas fa-check-circle', color: 'green' },
      { pattern: 'operational', icon: 'fas fa-check-circle', color: 'green' },
      { pattern: 'working', icon: 'fas fa-check-circle', color: 'green' },
      { pattern: 'good', icon: 'fas fa-check-circle', color: 'green' },
      { pattern: 'available', icon: 'fas fa-check-circle', color: 'green' },

      { pattern: 'maintenance', icon: 'fas fa-wrench', color: 'yellow' },
      { pattern: 'repair', icon: 'fas fa-wrench', color: 'yellow' },
      { pattern: 'service', icon: 'fas fa-tools', color: 'yellow' },
      { pattern: 'warning', icon: 'fas fa-exclamation-triangle', color: 'yellow' },

      { pattern: 'retired', icon: 'fas fa-archive', color: 'gray' },
      { pattern: 'disposed', icon: 'fas fa-archive', color: 'gray' },
      { pattern: 'end', icon: 'fas fa-archive', color: 'gray' },
      { pattern: 'inactive', icon: 'fas fa-pause-circle', color: 'gray' },

      { pattern: 'lost', icon: 'fas fa-times-circle', color: 'red' },
      { pattern: 'missing', icon: 'fas fa-times-circle', color: 'red' },
      { pattern: 'stolen', icon: 'fas fa-times-circle', color: 'red' },
      { pattern: 'damaged', icon: 'fas fa-times-circle', color: 'red' },
      { pattern: 'broken', icon: 'fas fa-times-circle', color: 'red' },

      { pattern: 'storage', icon: 'fas fa-box', color: 'blue' },
      { pattern: 'stock', icon: 'fas fa-box', color: 'blue' },
      { pattern: 'pending', icon: 'fas fa-clock', color: 'blue' },
    ];

    for (const update of updates) {
      await client.query(`
        UPDATE statuses
        SET
          icon = COALESCE(NULLIF(icon, 'fas fa-tag'), $1),
          color = COALESCE(NULLIF(color, 'gray'), $2)
        WHERE LOWER(name) LIKE $3
        AND (icon = 'fas fa-tag' OR icon IS NULL OR color = 'gray' OR color IS NULL)
      `, [update.icon, update.color, `%${update.pattern}%`]);
    }

    // Ensure all statuses have default values
    await client.query(`
      UPDATE statuses
      SET
        icon = COALESCE(icon, 'fas fa-tag'),
        color = COALESCE(color, 'gray'),
        is_active = COALESCE(is_active, TRUE),
        status_order = COALESCE(status_order, 999)
      WHERE icon IS NULL OR color IS NULL OR is_active IS NULL OR status_order IS NULL
    `);

    // Get the "New" status ID for updating items without status
    const newStatusResult = await client.query("SELECT id FROM statuses WHERE name = 'New' LIMIT 1");
    if (newStatusResult.rows.length > 0) {
      const newStatusId = newStatusResult.rows[0].id;

      // Update items without status to use "New" status
      const updatedItems = await client.query(`
        UPDATE items
        SET status_id = $1
        WHERE status_id IS NULL
        RETURNING id
      `, [newStatusId]);

      if (updatedItems.rows.length > 0) {
        console.log(`✅ Updated ${updatedItems.rows.length} items without status to "New"`);
      }
    }

    // Show final status summary
    const finalStatuses = await client.query(`
      SELECT
        s.name,
        s.icon,
        s.color,
        s.is_active,
        s.status_order,
        COUNT(i.id) as item_count
      FROM statuses s
      LEFT JOIN items i ON i.status_id = s.id
      GROUP BY s.id, s.name, s.icon, s.color, s.is_active, s.status_order
      ORDER BY s.status_order ASC, s.name ASC
    `);

    console.log('\n📊 Status System Summary:');
    console.log('='.repeat(60));
    finalStatuses.rows.forEach(status => {
      const activeIndicator = status.is_active ? '🟢' : '🔴';
      console.log(`${activeIndicator} ${status.name} (${status.color}) - ${status.item_count} items`);
      console.log(`   Icon: ${status.icon} | Order: ${status.status_order}`);
    });

    console.log('\n✅ Status system setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up status system:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  setupSafeStatusSystem()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = setupSafeStatusSystem;
