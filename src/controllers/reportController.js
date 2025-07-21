const db = require('../config/db');

// Report on asset allocation by department
exports.assetsByDepartment = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        d.name AS department,
        COUNT(i.id) AS total_items,
        SUM(i.price) AS total_value,
        STRING_AGG(DISTINCT t.name, ', ') AS asset_types
      FROM
        departments d
      LEFT JOIN
        employees e ON e.dept_id = d.id
      LEFT JOIN
        items i ON i.assigned_to = e.id
      LEFT JOIN
        types t ON i.type_id = t.id
      WHERE
        e.left_date IS NULL OR e.left_date > NOW()
      GROUP BY
        d.id, d.name
      ORDER BY
        total_value DESC NULLS LAST
    `);

    res.render('layout', {
      title: 'Assets by Department',
      body: 'reports/assets-by-department',
      departments: results.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Server error');
  }
};

// Report on unassigned assets
exports.unassignedAssets = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        i.id,
        i.cep_brc,
        i.name,
        t.name AS type_name,
        b.name AS brand_name,
        i.model,
        i.price,
        i.created_at,
        s.receipt,
        s.date_acquired
      FROM
        items i
      LEFT JOIN
        types t ON i.type_id = t.id
      LEFT JOIN
        brands b ON i.brand_id = b.id
      LEFT JOIN
        sales s ON i.receipt = s.receipt
      WHERE
        i.assigned_to IS NULL
      ORDER BY
        i.created_at DESC
    `);

    res.render('layout', {
      title: 'Unassigned Assets',
      body: 'reports/unassigned-assets',
      items: results.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Server error');
  }
};

// Report on asset purchase history
exports.assetPurchaseHistory = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        date_trunc('month', s.date_acquired) AS month,
        COUNT(i.id) AS items_purchased,
        SUM(i.price) AS total_spent,
        STRING_AGG(DISTINCT s.supplier, ', ') AS suppliers
      FROM
        sales s
      JOIN
        items i ON s.receipt = i.receipt
      GROUP BY
        month
      ORDER BY
        month DESC
    `);

    res.render('layout', {
      title: 'Purchase History',
      body: 'reports/purchase-history',
      history: results.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Server error');
  }
};

// Export asset data to CSV
exports.exportAssetsCSV = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        i.id,
        i.cep_brc,
        i.name,
        t.name AS type,
        b.name AS brand,
        i.model,
        i.serial_cod,
        i.price,
        e.name AS assigned_to,
        d.name AS department,
        i.date_assigned,
        s.receipt,
        s.supplier,
        s.date_acquired
      FROM
        items i
      LEFT JOIN
        types t ON i.type_id = t.id
      LEFT JOIN
        brands b ON i.brand_id = b.id
      LEFT JOIN
        employees e ON i.assigned_to = e.id
      LEFT JOIN
        departments d ON e.dept_id = d.id
      LEFT JOIN
        sales s ON i.receipt = s.receipt
      ORDER BY
        i.id
    `);

    // Create CSV header row
    let csvContent = "ID,CEP/BRC,Name,Type,Brand,Model,Serial,Price,Assigned To,Department,Date Assigned,Receipt,Supplier,Date Acquired\r\n";

    // Add data rows
    results.rows.forEach(item => {
      csvContent += [
        item.id,
        item.cep_brc,
        `"${item.name}"`,
        `"${item.type || ''}"`,
        `"${item.brand || ''}"`,
        `"${item.model || ''}"`,
        `"${item.serial_cod || ''}"`,
        item.price || '',
        `"${item.assigned_to || ''}"`,
        `"${item.department || ''}"`,
        item.date_assigned ? new Date(item.date_assigned).toISOString().split('T')[0] : '',
        `"${item.receipt || ''}"`,
        `"${item.supplier || ''}"`,
        item.date_acquired ? new Date(item.date_acquired).toISOString().split('T')[0] : ''
      ].join(',') + "\r\n";
    });

    // Set HTTP headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=assets.csv');

    // Send CSV content
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting assets:', error);
    res.status(500).send('Server error');
  }
};
