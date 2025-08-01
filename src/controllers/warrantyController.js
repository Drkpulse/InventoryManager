// src/controllers/warrantyController.js - Comprehensive warranty management
const db = require('../config/db');
const { createNotification } = require('./notificationController');

class WarrantyController {

  // Get warranty summary for dashboard
  static async getWarrantySummary(req, res) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(CASE WHEN warranty_status = 'expiring_soon' THEN 1 END) as expiring,
          COUNT(CASE WHEN warranty_status = 'expired' THEN 1 END) as expired,
          COUNT(CASE WHEN warranty_status = 'active' OR warranty_status = 'expiring_later' THEN 1 END) as active,
          COUNT(CASE WHEN warranty_status = 'no_warranty' THEN 1 END) as no_warranty
        FROM warranty_status_view
      `);

      // Get detailed alerts (top 10 most urgent)
      const alertsResult = await db.query(`
        SELECT *
        FROM warranty_status_view
        WHERE warranty_status IN ('expired', 'expiring_soon')
        ORDER BY
          CASE warranty_status
            WHEN 'expired' THEN 1
            WHEN 'expiring_soon' THEN 2
          END,
          ABS(days_until_expiry) ASC
        LIMIT 10
      `);

      const summary = result.rows[0];

      res.json({
        success: true,
        expiring: parseInt(summary.expiring) || 0,
        expired: parseInt(summary.expired) || 0,
        active: parseInt(summary.active) || 0,
        no_warranty: parseInt(summary.no_warranty) || 0,
        alerts: alertsResult.rows
      });

    } catch (error) {
      console.error('Error fetching warranty summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch warranty summary'
      });
    }
  }

  // Get warranty items with filtering and pagination
  static async getWarrantyItems(req, res) {
    try {
      const { status, page = 1, limit = 20, search } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramIndex = 1;

      // Filter by warranty status
      if (status && status !== 'all') {
        whereClause += ` AND warranty_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Search functionality
      if (search && search.trim()) {
        whereClause += ` AND (
          name ILIKE $${paramIndex} OR
          cep_brc ILIKE $${paramIndex} OR
          employee_name ILIKE $${paramIndex} OR
          type_name ILIKE $${paramIndex} OR
          brand_name ILIKE $${paramIndex}
        )`;
        params.push(`%${search.trim()}%`);
        paramIndex++;
      }

      // Get items
      const itemsQuery = `
        SELECT *
        FROM warranty_status_view
        ${whereClause}
        ORDER BY
          CASE warranty_status
            WHEN 'expired' THEN 1
            WHEN 'expiring_soon' THEN 2
            WHEN 'expiring_later' THEN 3
            WHEN 'active' THEN 4
            WHEN 'no_warranty' THEN 5
          END,
          warranty_end_date ASC NULLS LAST,
          name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);
      const itemsResult = await db.query(itemsQuery, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM warranty_status_view
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params.slice(0, -2));

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
  }

  // Update warranty information for an item
  static async updateItemWarranty(req, res) {
    try {
      const { id } = req.params;
      const { warranty_start_date, warranty_months, warranty_end_date } = req.body;

      // Validate input
      if (warranty_start_date && isNaN(Date.parse(warranty_start_date))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid warranty start date'
        });
      }

      if (warranty_months && (isNaN(warranty_months) || warranty_months < 0)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid warranty months'
        });
      }

      if (warranty_end_date && isNaN(Date.parse(warranty_end_date))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid warranty end date'
        });
      }

      // Update the item
      const updateQuery = `
        UPDATE items
        SET warranty_start_date = $1,
            warranty_months = $2,
            warranty_end_date = $3
        WHERE id = $4
        RETURNING id, cep_brc, name
      `;

      const result = await db.query(updateQuery, [
        warranty_start_date || null,
        warranty_months || null,
        warranty_end_date || null,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Log the warranty update
      await db.query(`
        INSERT INTO item_history (item_id, action_type, action_details, performed_by, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        id,
        'warranty_updated',
        JSON.stringify({
          warranty_start_date,
          warranty_months,
          warranty_end_date
        }),
        req.session.user.id
      ]);

      res.json({
        success: true,
        message: 'Warranty information updated successfully',
        item: result.rows[0]
      });

    } catch (error) {
      console.error('Error updating warranty information:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update warranty information'
      });
    }
  }

  // Run warranty expiration check and create notifications
  static async checkWarrantyExpiration() {
    try {
      console.log('🔍 Starting warranty expiration check...');

      // Get expired warranties
      const expiredResult = await db.query(`
        SELECT *
        FROM warranty_status_view
        WHERE warranty_status = 'expired'
        AND warranty_end_date >= CURRENT_DATE - INTERVAL '7 days'
      `);

      // Get warranties expiring soon (next 30 days)
      const expiringSoonResult = await db.query(`
        SELECT *
        FROM warranty_status_view
        WHERE warranty_status = 'expiring_soon'
      `);

      // Get warranties expiring in 90 days (early warning)
      const expiringLaterResult = await db.query(`
        SELECT *
        FROM warranty_status_view
        WHERE warranty_status = 'expiring_later'
        AND days_until_expiry <= 90
      `);

      let notificationsCreated = 0;

      // Create notifications for expired warranties
      for (const item of expiredResult.rows) {
        // Check if we already sent a notification for this expiration
        const existingNotification = await db.query(`
          SELECT id FROM notifications
          WHERE title LIKE '%Warranty Expired%'
          AND url LIKE '%/items/${item.id}/%'
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        `);

        if (existingNotification.rows.length === 0) {
          await createNotification(
            null, // Send to all admins
            'warranty_expired',
            'Warranty Expired',
            `Asset "${item.name}" (${item.cep_brc}) warranty expired ${Math.abs(item.days_until_expiry)} days ago`,
            `/items/${item.id}/${item.cep_brc}`
          );
          notificationsCreated++;
        }
      }

      // Create notifications for warranties expiring soon
      for (const item of expiringSoonResult.rows) {
        const existingNotification = await db.query(`
          SELECT id FROM notifications
          WHERE title LIKE '%Warranty Expiring%'
          AND url LIKE '%/items/${item.id}/%'
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        `);

        if (existingNotification.rows.length === 0) {
          await createNotification(
            null, // Send to all admins
            'warranty_expiring',
            'Warranty Expiring Soon',
            `Asset "${item.name}" (${item.cep_brc}) warranty expires in ${item.days_until_expiry} days`,
            `/items/${item.id}/${item.cep_brc}`
          );
          notificationsCreated++;
        }
      }

      // Create early warning notifications for warranties expiring in 90 days
      for (const item of expiringLaterResult.rows) {
        // Only send 90-day warnings once
        const existingNotification = await db.query(`
          SELECT id FROM notifications
          WHERE title LIKE '%Warranty Warning%'
          AND url LIKE '%/items/${item.id}/%'
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        `);

        if (existingNotification.rows.length === 0 && item.days_until_expiry <= 90 && item.days_until_expiry >= 85) {
          await createNotification(
            null, // Send to all admins
            'warranty_warning',
            'Warranty Warning',
            `Asset "${item.name}" (${item.cep_brc}) warranty expires in ${item.days_until_expiry} days`,
            `/items/${item.id}/${item.cep_brc}`
          );
          notificationsCreated++;
        }
      }

      const result = {
        expired: expiredResult.rows.length,
        expiring: expiringSoonResult.rows.length,
        expiring_later: expiringLaterResult.rows.filter(item => item.days_until_expiry <= 90).length,
        notifications_created: notificationsCreated
      };

      console.log(`✅ Warranty check completed:`, result);
      return result;

    } catch (error) {
      console.error('❌ Error in warranty expiration check:', error);
      throw error;
    }
  }

  // Get warranty statistics
  static async getWarrantyStats(req, res) {
    try {
      const stats = await db.query(`
        SELECT
          warranty_status,
          COUNT(*) as count,
          AVG(CASE WHEN days_until_expiry IS NOT NULL THEN ABS(days_until_expiry) END) as avg_days
        FROM warranty_status_view
        GROUP BY warranty_status
        ORDER BY
          CASE warranty_status
            WHEN 'expired' THEN 1
            WHEN 'expiring_soon' THEN 2
            WHEN 'expiring_later' THEN 3
            WHEN 'active' THEN 4
            WHEN 'no_warranty' THEN 5
          END
      `);

      // Get monthly warranty expiration trend
      const trend = await db.query(`
        SELECT
          DATE_TRUNC('month', warranty_end_date) as month,
          COUNT(*) as expiring_count
        FROM items
        WHERE warranty_end_date IS NOT NULL
        AND warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', warranty_end_date)
        ORDER BY month
      `);

      res.json({
        success: true,
        stats: stats.rows,
        trend: trend.rows
      });

    } catch (error) {
      console.error('Error fetching warranty stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch warranty statistics'
      });
    }
  }

  // Manual warranty check endpoint
  static async manualWarrantyCheck(req, res) {
    try {
      const result = await WarrantyController.checkWarrantyExpiration();

      res.json({
        success: true,
        message: `Warranty check completed. Found ${result.expired} expired, ${result.expiring} expiring soon. Created ${result.notifications_created} notifications.`,
        ...result
      });

    } catch (error) {
      console.error('Error in manual warranty check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run warranty check'
      });
    }
  }
}

module.exports = WarrantyController;
