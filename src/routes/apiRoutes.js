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

module.exports = router;
