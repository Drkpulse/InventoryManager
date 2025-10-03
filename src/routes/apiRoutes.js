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

      warrantyStats
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM items'),
      db.query('SELECT COUNT(*) as count FROM employees WHERE left_date IS NULL'),
      db.query('SELECT COUNT(*) as count FROM items WHERE assigned_to IS NULL'),

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









module.exports = router;
