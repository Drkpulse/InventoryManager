const db = require('../config/db');

module.exports = {
  // Asset Reports
  assets: async (req, res) => {
    try {
      // Get asset statistics
      const assetStats = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status_id = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status_id = 2 THEN 1 ELSE 0 END) as maintenance,
          SUM(CASE WHEN status_id = 3 THEN 1 ELSE 0 END) as retired
        FROM items
      `);

      // Get asset types distribution
      const assetTypes = await db.query(`
        SELECT t.name, COUNT(*) as count
        FROM items i
        JOIN asset_types t ON i.type_id = t.id
        GROUP BY t.name
        ORDER BY count DESC
      `);

      res.render('reports/assets', {
        title: 'Asset Reports',
        user: req.session.user,
        stats: assetStats[0],
        assetTypes: assetTypes,
        isReportPage: true
      });
    } catch (error) {
      console.error('Error generating asset report:', error);
      res.render('error', {
        title: 'Error',
        message: 'Could not generate asset report',
        user: req.session.user
      });
    }
  },

  // Purchase History Report
  purchaseHistory: async (req, res) => {
    try {
      const purchases = await db.query(`
        SELECT i.id, i.name, i.purchase_date, i.purchase_price, i.supplier, t.name as type_name
        FROM items i
        JOIN asset_types t ON i.type_id = t.id
        WHERE i.purchase_date IS NOT NULL
        ORDER BY i.purchase_date DESC
      `);

      res.render('reports/purchase-history', {
        title: 'Purchase History',
        user: req.session.user,
        purchases: purchases,
        isReportPage: true
      });
    } catch (error) {
      console.error('Error generating purchase history:', error);
      res.render('error', {
        title: 'Error',
        message: 'Could not generate purchase history report',
        user: req.session.user
      });
    }
  },

  // Assets by Employee Report
  assetsByEmployee: async (req, res) => {
    try {
      const employeeAssets = await db.query(`
        SELECT e.id, e.name, e.email, e.department_id, d.name as department_name,
               COUNT(i.id) as asset_count
        FROM employees e
        LEFT JOIN items i ON i.assigned_to = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        GROUP BY e.id, e.name, e.email, e.department_id, d.name
        ORDER BY asset_count DESC
      `);

      res.render('reports/assets-by-employee', {
        title: 'Assets by Employee',
        user: req.session.user,
        employeeAssets: employeeAssets,
        isReportPage: true
      });
    } catch (error) {
      console.error('Error generating assets by employee report:', error);
      res.render('error', {
        title: 'Error',
        message: 'Could not generate assets by employee report',
        user: req.session.user
      });
    }
  }
};
