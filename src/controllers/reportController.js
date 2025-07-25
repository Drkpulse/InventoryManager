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

// Report on assets assigned to each employee
exports.assetsByEmployee = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        e.cep AS employee_cep,
        d.name AS department,
        COUNT(i.id) AS total_items,
        SUM(i.price) AS total_value,
        STRING_AGG(DISTINCT t.name, ', ') AS asset_types,
        STRING_AGG(DISTINCT i.cep_brc, ', ') AS asset_ids
      FROM
        employees e
      LEFT JOIN
        departments d ON e.dept_id = d.id
      LEFT JOIN
        items i ON i.assigned_to = e.id
      LEFT JOIN
        types t ON i.type_id = t.id
      WHERE
        e.left_date IS NULL OR e.left_date > NOW()
      GROUP BY
        e.id, e.name, e.cep, d.name
      ORDER BY
        total_items DESC NULLS LAST, e.name ASC
    `);

    res.render('layout', {
      title: 'Assets by Employee',
      body: 'reports/assets-by-employee',
      employees: results.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error generating assets by employee report:', error);
    res.status(500).send('Server error');
  }
};

// Export assets by employee to CSV
exports.exportAssetsByEmployee = async (req, res) => {
  try {
    const results = await db.query(`
      SELECT
        e.name AS "Employee Name",
        e.cep AS "Employee ID",
        d.name AS "Department",
        COUNT(i.id) AS "Total Items",
        SUM(i.price) AS "Total Value",
        STRING_AGG(DISTINCT t.name, ', ') AS "Asset Types"
      FROM
        employees e
      LEFT JOIN
        departments d ON e.dept_id = d.id
      LEFT JOIN
        items i ON i.assigned_to = e.id
      LEFT JOIN
        types t ON i.type_id = t.id
      WHERE
        e.left_date IS NULL OR e.left_date > NOW()
      GROUP BY
        e.id, e.name, e.cep, d.name
      ORDER BY
        COUNT(i.id) DESC NULLS LAST, e.name ASC
    `);

    // Create CSV header
    let csv = '"Employee Name","Employee ID","Department","Total Items","Total Value","Asset Types"\r\n';

    // Add data rows
    results.rows.forEach(row => {
      const totalValue = row["Total Value"] ? parseFloat(row["Total Value"]).toFixed(2) : '0.00';
      csv += `"${row["Employee Name"]}","${row["Employee ID"]}","${row["Department"] || ''}","${row["Total Items"] || 0}","$${totalValue}","${row["Asset Types"] || ''}"\r\n`;
    });

    // Set headers for CSV download
    res.setHeader('Content-Disposition', 'attachment; filename=assets-by-employee.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting assets by employee:', error);
    res.status(500).send('Server error');
  }
};

// Detailed report on assets assigned to a specific employee
exports.employeeAssetDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee details
    const employeeResult = await db.query(`
      SELECT e.*, d.name as department_name,
             p.name as platform_name, o.name as office_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN platforms p ON e.platform_id = p.id
      LEFT JOIN offices o ON e.office_id = o.id
      WHERE e.id = $1
    `, [id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).send('Employee not found');
    }

    // Get assigned items
    const itemsResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      WHERE i.assigned_to = $1
      ORDER BY i.name
    `, [id]);

    // Get summary statistics
    const statsResult = await db.query(`
      SELECT
        COUNT(i.id) as total_items,
        SUM(i.price) as total_value,
        STRING_AGG(DISTINCT t.name, ', ') as asset_types
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      WHERE i.assigned_to = $1
    `, [id]);

    res.render('layout', {
      title: `Assets - ${employeeResult.rows[0].name}`,
      body: 'reports/employee-asset-details',
      employee: employeeResult.rows[0],
      items: itemsResult.rows,
      stats: statsResult.rows[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error getting employee asset details:', error);
    res.status(500).send('Server error');
  }
};

// General asset reports page
exports.assets = async (req, res) => {
  try {
    // Placeholder for real report logic
    res.render('layout', {
      title: 'Asset Reports',
      body: 'reports/assets',
      user: req.session.user,
      isReportPage: true,
      data: { /* Your report data would go here */ }
    });
  } catch (error) {
    console.error('Error generating asset report:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not generate asset report',
      user: req.session.user
    });
  }
};

// Report on purchase history (general)
exports.purchaseHistory = async (req, res) => {
  try {
    res.render('layout', {
      title: 'Purchase History',
      body: 'reports/purchase-history',
      user: req.session.user,
      isReportPage: true,
      data: { /* Your report data would go here */ }
    });
  } catch (error) {
    console.error('Error generating purchase history:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not generate purchase history report',
      user: req.session.user
    });
  }
};

// Report on assets assigned to each employee (general)
exports.assetsByEmployee = async (req, res) => {
  try {
    res.render('layout', {
      title: 'Assets by Employee',
      body: 'reports/assets-by-employee',
      user: req.session.user,
      isReportPage: true,
      data: { /* Your report data would go here */ }
    });
  } catch (error) {
    console.error('Error generating assets by employee report:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not generate assets by employee report',
      user: req.session.user
    });
  }
};

// Add this method to your report controller (or update the existing one)
exports.assetsReport = async (req, res) => {
  try {
    // Fetch all items with related data for the analytics
    const itemsResult = await db.query(`
      SELECT
        i.*,
        t.name as type_name,
        b.name as brand_name,
        e.name as assigned_to_name,
        e.id as assigned_to,
        e.cep as employee_cep,
        d.name as department_name,
        l.name as location_name,
        s.date_acquired,
        s.supplier
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ORDER BY i.created_at DESC
    `);

    console.log(`Fetched ${itemsResult.rows.length} items for assets report`);

    res.render('layout', {
      title: 'Asset Analytics Report',
      body: 'reports/assets',
      items: itemsResult.rows, // This is the critical data that was missing!
      user: req.session.user,
      isReportPage: true
    });
  } catch (error) {
    console.error('Error loading assets report:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load assets report: ' + error.message,
      user: req.session.user
    });
  }
};
