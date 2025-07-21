const db = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    // Get counts for dashboard widgets
    const itemCount = await db.query('SELECT COUNT(*) FROM items');
    const employeeCount = await db.query('SELECT COUNT(*) FROM employees WHERE left_date IS NULL');
    const departmentCount = await db.query('SELECT COUNT(*) FROM departments');

    // Get items by type distribution
    const itemsByType = await db.query(`
      SELECT t.name, COUNT(i.id) as count
      FROM items i
      JOIN types t ON i.type_id = t.id
      GROUP BY t.name
      ORDER BY count DESC
    `);

    // Get recent items
    const recentItems = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    // Get unassigned items
    const unassignedItems = await db.query(`
      SELECT COUNT(*) FROM items WHERE assigned_to IS NULL
    `);

    res.render('layout', {
      title: 'Dashboard',
      body: 'dashboard/index',
      stats: {
        itemCount: itemCount.rows[0].count,
        employeeCount: employeeCount.rows[0].count,
        departmentCount: departmentCount.rows[0].count,
        unassignedCount: unassignedItems.rows[0].count
      },
      itemsByType: itemsByType.rows,
      recentItems: recentItems.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Server error');
  }
};
