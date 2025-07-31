const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Employees API routes (remove the /api prefix since it's already in the mount path)
router.get('/employees/available', isAuthenticated, async (req, res) => {
  try {
    const employees = await db.query(`
      SELECT
        e.id,
        e.name,
        e.cep,
        d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE e.left_date IS NULL
      ORDER BY e.name
    `);

    res.json(employees.rows);
  } catch (error) {
    console.error('Error fetching available employees:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Items API routes
router.get('/items/check-duplicate/:assetId', isAuthenticated, async (req, res) => {
  try {
    const { assetId } = req.params;

    const result = await db.query(`
      SELECT
        i.id,
        i.cep_brc,
        i.name,
        t.name as type_name,
        b.name as brand_name,
        e.name as assigned_to_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE i.cep_brc = $1
    `, [assetId]);

    if (result.rows.length > 0) {
      res.json({
        exists: true,
        asset: result.rows[0]
      });
    } else {
      res.json({
        exists: false
      });
    }
  } catch (error) {
    console.error('Error checking duplicate asset ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const dashboardController = require('../controllers/dashboardController');
// Global search endpoint
router.get('/search', dashboardController.searchAssets);

// Get warranty summary for admin dashboard
router.get('/warranties/summary', isAdmin, async (req, res) => {
  try {
    // Get items expiring in next 30 days
    const expiringResult = await db.query(`
      SELECT COUNT(*) as count
      FROM items
      WHERE warranty_end_date IS NOT NULL
      AND warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    `);

    // Get expired items
    const expiredResult = await db.query(`
      SELECT COUNT(*) as count
      FROM items
      WHERE warranty_end_date IS NOT NULL
      AND warranty_end_date < CURRENT_DATE
    `);

    // Get detailed alerts for display
    const alertsResult = await db.query(`
      SELECT
        i.id as item_id,
        i.cep_brc,
        i.name,
        i.warranty_end_date,
        CASE
          WHEN i.warranty_end_date < CURRENT_DATE
          THEN -EXTRACT(days FROM CURRENT_DATE - i.warranty_end_date)::integer
          ELSE EXTRACT(days FROM i.warranty_end_date - CURRENT_DATE)::integer
        END as days_until_expiry
      FROM items i
      WHERE i.warranty_end_date IS NOT NULL
      AND (
        i.warranty_end_date < CURRENT_DATE
        OR i.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      )
      ORDER BY i.warranty_end_date ASC
      LIMIT 10
    `);

    res.json({
      success: true,
      expiring: parseInt(expiringResult.rows[0].count),
      expired: parseInt(expiredResult.rows[0].count),
      alerts: alertsResult.rows
    });
  } catch (error) {
    console.error('Error fetching warranty summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warranty summary'
    });
  }
});

// Get items with warranty information
router.get('/warranties/items', isAuthenticated, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE i.warranty_end_date IS NOT NULL';
    let params = [limit, offset];
    let paramIndex = 3;

    if (status === 'expiring') {
      whereClause += ` AND i.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`;
    } else if (status === 'expired') {
      whereClause += ` AND i.warranty_end_date < CURRENT_DATE`;
    } else if (status === 'active') {
      whereClause += ` AND i.warranty_end_date > CURRENT_DATE + INTERVAL '30 days'`;
    }

    const itemsResult = await db.query(`
      SELECT
        i.id,
        i.cep_brc,
        i.name,
        i.warranty_start_date,
        i.warranty_end_date,
        i.warranty_months,
        t.name as type_name,
        b.name as brand_name,
        e.name as employee_name,
        CASE
          WHEN i.warranty_end_date < CURRENT_DATE
          THEN -EXTRACT(days FROM CURRENT_DATE - i.warranty_end_date)::integer
          ELSE EXTRACT(days FROM i.warranty_end_date - CURRENT_DATE)::integer
        END as days_until_expiry
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      ${whereClause}
      ORDER BY i.warranty_end_date ASC
      LIMIT $1 OFFSET $2
    `, params);

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM items i
      ${whereClause.replace('LIMIT $1 OFFSET $2', '')}
    `, params.slice(2));

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      items: itemsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching warranty items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warranty items'
    });
  }
});

// Update item warranty information
router.put('/warranties/items/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { warranty_start_date, warranty_months, warranty_end_date } = req.body;

    // Calculate end date if not provided
    let endDate = warranty_end_date;
    if (warranty_start_date && warranty_months && !warranty_end_date) {
      const startDate = new Date(warranty_start_date);
      const calculatedEndDate = new Date(startDate);
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + parseInt(warranty_months));
      endDate = calculatedEndDate.toISOString().split('T')[0];
    }

    await db.query(`
      UPDATE items
      SET warranty_start_date = $1, warranty_months = $2, warranty_end_date = $3
      WHERE id = $4
    `, [warranty_start_date || null, warranty_months || null, endDate || null, id]);

    res.json({
      success: true,
      message: 'Warranty information updated successfully'
    });
  } catch (error) {
    console.error('Error updating warranty information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update warranty information'
    });
  }
});

// Warranty summary endpoint for admin dashboard
router.get('/warranties/summary', isAuthenticated, async (req, res) => {
  try {
    // Get items expiring in next 30 days
    const expiringResult = await db.query(`
      SELECT
        i.id,
        i.name,
        i.cep_brc,
        i.warranty_end_date,
        EXTRACT(DAY FROM (i.warranty_end_date - CURRENT_DATE)) as days_until_expiry,
        e.name as employee_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE i.warranty_end_date IS NOT NULL
      AND i.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY i.warranty_end_date ASC
    `);

    // Get items already expired
    const expiredResult = await db.query(`
      SELECT
        i.id,
        i.name,
        i.cep_brc,
        i.warranty_end_date,
        EXTRACT(DAY FROM (CURRENT_DATE - i.warranty_end_date)) as days_expired,
        e.name as employee_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE i.warranty_end_date IS NOT NULL
      AND i.warranty_end_date < CURRENT_DATE
      ORDER BY i.warranty_end_date DESC
      LIMIT 20
    `);

    // Combine expiring and expired for alerts
    const alerts = [
      ...expiringResult.rows.map(item => ({
        ...item,
        days_until_expiry: parseInt(item.days_until_expiry),
        status: 'expiring'
      })),
      ...expiredResult.rows.map(item => ({
        ...item,
        days_until_expiry: -parseInt(item.days_expired),
        status: 'expired'
      }))
    ].sort((a, b) => Math.abs(a.days_until_expiry) - Math.abs(b.days_until_expiry));

    res.json({
      success: true,
      expiring: expiringResult.rows.length,
      expired: expiredResult.rows.length,
      alerts: alerts.slice(0, 10) // Return top 10 for dashboard
    });

  } catch (error) {
    console.error('Error fetching warranty summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warranty summary'
    });
  }
});

// System statistics endpoint
router.get('/system/stats', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get various statistics
    const [
      totalItems,
      totalEmployees,
      unassignedItems,
      activeNotifications
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM items'),
      db.query('SELECT COUNT(*) as count FROM employees'),
      db.query('SELECT COUNT(*) as count FROM items WHERE assigned_to IS NULL'),
      db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId])
    ]);

    res.json({
      success: true,
      stats: {
        totalItems: parseInt(totalItems.rows[0].count),
        totalEmployees: parseInt(totalEmployees.rows[0].count),
        unassignedItems: parseInt(unassignedItems.rows[0].count),
        activeNotifications: parseInt(activeNotifications.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics'
    });
  }
});

// Recent activity endpoint
router.get('/activity/recent', isAuthenticated, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent notifications for current user
    const recentActivity = await db.query(`
      SELECT
        n.id,
        n.title,
        n.message,
        n.url,
        n.is_read,
        n.created_at,
        nt.icon,
        nt.color
      FROM notifications n
      JOIN notification_types nt ON n.type_id = nt.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2
    `, [req.session.user.id, limit]);

    res.json({
      success: true,
      activities: recentActivity.rows
    });

  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity'
    });
  }
});

// Admin-only: Get all users' notification statistics
router.get('/notifications/stats', isAdmin, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        u.name as user_name,
        COUNT(n.id) as total_notifications,
        COUNT(CASE WHEN n.is_read = FALSE THEN 1 END) as unread_notifications,
        MAX(n.created_at) as last_notification
      FROM users u
      LEFT JOIN notifications n ON u.id = n.user_id
      GROUP BY u.id, u.name
      ORDER BY unread_notifications DESC, total_notifications DESC
    `);

    res.json({
      success: true,
      userStats: stats.rows
    });

  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification statistics'
    });
  }
});

// Health check for notifications system
router.get('/health/notifications', isAuthenticated, async (req, res) => {
  try {
    // Test database connections
    const [typesTest, notificationsTest, settingsTest] = await Promise.all([
      db.query('SELECT COUNT(*) FROM notification_types'),
      db.query('SELECT COUNT(*) FROM notifications LIMIT 1'),
      db.query('SELECT COUNT(*) FROM notification_settings LIMIT 1')
    ]);

    res.json({
      success: true,
      status: 'healthy',
      checks: {
        notification_types: parseInt(typesTest.rows[0].count),
        notifications_accessible: true,
        settings_accessible: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
