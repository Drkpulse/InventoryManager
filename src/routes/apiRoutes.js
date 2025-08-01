const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const WarrantyController = require('../controllers/warrantyController');

// Employees API routes
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

// Global search endpoint
const dashboardController = require('../controllers/dashboardController');
router.get('/search', dashboardController.searchAssets);

// === ENHANCED WARRANTY ENDPOINTS ===

// Get warranty summary for dashboard
router.get('/warranties/summary', isAuthenticated, WarrantyController.getWarrantySummary);

// Get warranty items with filtering and pagination
router.get('/warranties/items', isAuthenticated, WarrantyController.getWarrantyItems);

// Update item warranty information
router.put('/warranties/items/:id', isAuthenticated, WarrantyController.updateItemWarranty);

// Get warranty statistics
router.get('/warranties/stats', isAuthenticated, WarrantyController.getWarrantyStats);

// Manual warranty check (admin only)
router.post('/warranties/check', isAdmin, WarrantyController.manualWarrantyCheck);

// === SYSTEM ENDPOINTS ===

// System statistics endpoint
router.get('/system/stats', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get various statistics
    const [
      totalItems,
      totalEmployees,
      unassignedItems,
      activeNotifications,
      warrantyStats
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM items'),
      db.query('SELECT COUNT(*) as count FROM employees WHERE left_date IS NULL'),
      db.query('SELECT COUNT(*) as count FROM items WHERE assigned_to IS NULL'),
      db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE', [userId]),
      db.query(`
        SELECT
          COUNT(CASE WHEN warranty_status = 'expired' THEN 1 END) as expired,
          COUNT(CASE WHEN warranty_status = 'expiring_soon' THEN 1 END) as expiring
        FROM warranty_status_view
      `)
    ]);

    const warrantyData = warrantyStats.rows[0];

    res.json({
      success: true,
      stats: {
        totalItems: parseInt(totalItems.rows[0].count),
        totalEmployees: parseInt(totalEmployees.rows[0].count),
        unassignedItems: parseInt(unassignedItems.rows[0].count),
        activeNotifications: parseInt(activeNotifications.rows[0].count),
        expiredWarranties: parseInt(warrantyData.expired) || 0,
        expiringWarranties: parseInt(warrantyData.expiring) || 0
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
