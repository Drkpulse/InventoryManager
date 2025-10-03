const db = require('../config/db');
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');



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
      SELECT e.*, d.name as department_name, l.name as location_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
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



exports.assetsReport = async (req, res) => {
  try {
    const itemsResult = await db.query(`
      SELECT
        i.*,
        t.name as type_name,
        b.name as brand_name,
        e.name as assigned_to_name,
        e.id as assigned_to,
        d.name as department_name,
        s.date_acquired
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ORDER BY i.created_at DESC
    `);

    const items = itemsResult.rows;
    const totalAssets = items.length;
    const totalValue = items.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    const avgValue = totalAssets ? totalValue / totalAssets : 0;
    const assignedAssets = items.filter(a => a.assigned_to).length;
    const utilizationRate = totalAssets ? (assignedAssets / totalAssets) * 100 : 0;
    const unassignedAssets = totalAssets - assignedAssets;
    const itemsNeedingAttention = items.filter(a => a.condition === 'maintenance' || a.condition === 'damaged').length;
    const highValueAssets = items.filter(a => parseFloat(a.price) > 5000).length;
    const unassignedValue = items.filter(a => !a.assigned_to).reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    const allConditions = Array.from(new Set(items.map(i => i.condition || 'active')));
    const typesResult = await db.query('SELECT name FROM types ORDER BY name');
    const statusesResult = await db.query('SELECT name FROM statuses ORDER BY status_order, name');
    const allTypes = typesResult.rows;
    const allStatuses = statusesResult.rows;

    // Breakdown calculations
    const typeCounts = {};
    const valueRanges = { 'under_500': 0, '500-2000': 0, '2000-5000': 0, 'over_5000': 0 };
    const ageBreakdown = { '0-1': 0, '1-3': 0, '3-5': 0, '5+': 0 };
    const deptCounts = {};
    const conditionBreakdown = {};

    items.forEach(item => {
      // Types
      if (item.type_name) typeCounts[item.type_name] = (typeCounts[item.type_name] || 0) + 1;
      // Value ranges
      const price = parseFloat(item.price) || 0;
      if (price < 500) valueRanges['under_500']++;
      else if (price < 2000) valueRanges['500-2000']++;
      else if (price < 5000) valueRanges['2000-5000']++;
      else valueRanges['over_5000']++;
      // Age
      if (item.date_acquired) {
        const years = (new Date() - new Date(item.date_acquired)) / (1000 * 60 * 60 * 24 * 365);
        if (years < 1) ageBreakdown['0-1']++;
        else if (years < 3) ageBreakdown['1-3']++;
        else if (years < 5) ageBreakdown['3-5']++;
        else ageBreakdown['5+']++;
      }
      // Departments
      if (item.department_name && item.assigned_to) deptCounts[item.department_name] = (deptCounts[item.department_name] || 0) + 1;
      // Condition
      const cond = item.condition || 'active';
      conditionBreakdown[cond] = (conditionBreakdown[cond] || 0) + 1;
    });

    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topDepartments = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maintenanceRate = totalAssets ? ((conditionBreakdown['maintenance'] || 0) / totalAssets) * 100 : 0;

    // Sanitize items for table
    const safeItems = items.map(a => ({
      id: a.id,
      cep_brc: a.cep_brc,
      name: a.name,
      type_name: a.type_name,
      brand_name: a.brand_name,
      price: a.price,
      assigned_to: a.assigned_to,
      assigned_to_name: a.assigned_to_name,
      department_name: a.department_name,
      date_acquired: a.date_acquired,
      condition: a.condition
    }));

    res.render('layout', {
      title: 'Asset Analytics Report',
      body: 'reports/assets',
      totalAssets,
      totalValue,
      avgValue,
      utilizationRate,
      assignedAssets,
      unassignedAssets,
      itemsNeedingAttention,
      highValueAssets,
      unassignedValue,
      topTypes,
      valueRanges,
      ageBreakdown,
      topDepartments,
      conditionBreakdown,
      maintenanceRate,
      safeItems,
      user: req.session.user,
      allTypes,
      allStatuses,
      allConditions,
      isReportPage: true
    });
  } catch (error) {
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load assets report: ' + error.message,
      user: req.session.user
    });
  }
};

// Employee full assets report (detailed view with PDF export)
exports.employeeFullAssetsPDF = async (req, res) => {
  const employeeId = req.params.id;
  try {
    // Fetch employee details
    const employeeResult = await db.query(`
      SELECT e.*, d.name as department_name, l.name as location_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.id = $1
    `, [employeeId]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).send('Employee not found');
    }

    const employee = employeeResult.rows[0];

    // Fetch assigned items
    const itemsResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      WHERE i.assigned_to = $1
      ORDER BY i.name
    `, [employeeId]);

    const items = itemsResult.rows;

    // Calculate stats
    const stats = {
      total_items: items.length,
      total_value: items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0),
      asset_types: [...new Set(items.map(i => i.type_name).filter(Boolean))].join(', ')
    };

    // Check if this is a PDF print request
    if (req.query.format === 'pdf') {
      console.log('📄 Generating print-friendly PDF page for employee:', employee.name);

      // Render the print-friendly PDF page (no layout wrapper for clean printing)
      return res.render('reports/print-pdf', {
        title: `Asset Report - ${employee.name}`,
        employee,
        items,
        stats,
        layout: false
      });
    }

    // For regular HTML report, render the standard template
    console.log('📊 Generating standard HTML report for employee:', employee.name);

    const html = await ejs.renderFile(
      path.join(__dirname, '../views/reports/employee-full-assets.ejs'),
      { employee, items, stats }
    );

    res.send(html);

  } catch (error) {
    console.error('Error generating employee full assets report:', error);
    res.status(500).send('Server error');
  }
};
