const db = require('../config/db');

exports.index = async (req, res) => {
  try {
    const software = await db.query(`
      SELECT
        s.id,
        s.name,
        s.version,
        s.license_type,
        s.cost_per_license,
        s.vendor,
        s.description,
        s.max_licenses,
        COUNT(es.employee_id) as employee_count
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      GROUP BY s.id, s.name, s.version, s.license_type, s.cost_per_license, s.vendor, s.description, s.max_licenses
      ORDER BY s.name
    `);

    res.render('layout', {
      title: 'Software Management',
      body: 'software/index',
      user: req.session.user,
      software: software.rows,
      isSoftwarePage: true
    });
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch software',
      user: req.session.user
    });
  }
};

exports.showAddForm = (req, res) => {
  res.render('layout', {
    title: 'Add Software',
    body: 'software/add',
    user: req.session.user,
    isSoftwarePage: true
  });
};

exports.create = async (req, res) => {
  try {
    const { name, version, license_type, cost_per_license, vendor, description, max_licenses } = req.body;

    await db.query(`
      INSERT INTO software (name, version, license_type, cost_per_license, vendor, description, max_licenses)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, version, license_type, cost_per_license || null, vendor, description, max_licenses || 1]);

    req.flash('success', 'Software added successfully');
    res.redirect('/software');
  } catch (error) {
    console.error('Error adding software:', error);
    req.flash('error', 'Failed to add software');
    res.redirect('/software/add');
  }
};

exports.showEditForm = async (req, res) => {
  try {
    const softwareId = req.params.id;

    const software = await db.query(`
      SELECT
        s.id,
        s.name,
        s.version,
        s.license_type,
        s.cost_per_license,
        s.vendor,
        s.description,
        s.max_licenses,
        COUNT(es.employee_id) as employee_count
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.version, s.license_type, s.cost_per_license, s.vendor, s.description, s.max_licenses
    `, [softwareId]);

    if (software.rows.length === 0) {
      req.flash('error', 'Software not found');
      return res.redirect('/software');
    }

    res.render('layout', {
      title: 'Edit Software',
      body: 'software/edit',
      user: req.session.user,
      software: software.rows[0],
      isSoftwarePage: true
    });
  } catch (error) {
    console.error('Error fetching software:', error);
    req.flash('error', 'Could not fetch software data');
    res.redirect('/software');
  }
};

exports.update = async (req, res) => {
  try {
    const softwareId = req.params.id;
    const { name, version, license_type, cost_per_license, vendor, description, max_licenses } = req.body;

    await db.query(`
      UPDATE software
      SET name = $1, version = $2, license_type = $3, cost_per_license = $4, vendor = $5, description = $6, max_licenses = $7
      WHERE id = $8
    `, [name, version, license_type, cost_per_license || null, vendor, description, max_licenses || 1, softwareId]);

    req.flash('success', 'Software updated successfully');
    res.redirect('/software');
  } catch (error) {
    console.error('Error updating software:', error);
    req.flash('error', 'Failed to update software');
    res.redirect(`/software/${req.params.id}/edit`);
  }
};

exports.delete = async (req, res) => {
  try {
    const softwareId = req.params.id;

    // Check if there are any employees using this software
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employee_software
      WHERE software_id = $1
    `, [softwareId]);

    if (parseInt(result.rows[0].count) > 0) {
      req.flash('error', `Cannot delete: This software is assigned to ${result.rows[0].count} employees`);
      return res.redirect('/software');
    }

    await db.query(`DELETE FROM software WHERE id = $1`, [softwareId]);

    req.flash('success', 'Software deleted successfully');
    res.redirect('/software');
  } catch (error) {
    console.error('Error deleting software:', error);
    req.flash('error', 'Failed to delete software');
    res.redirect('/software');
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const { id } = req.params;

    // Get software details
    const softwareResult = await db.query(`
      SELECT id, name, version, vendor, max_licenses
      FROM software
      WHERE id = $1
    `, [id]);

    if (softwareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Get assignments
    const assignmentsResult = await db.query(`
      SELECT
        es.employee_id,
        es.assigned_date,
        es.notes,
        e.name as employee_name,
        e.cep as employee_cep,
        d.name as department_name
      FROM employee_software es
      JOIN employees e ON es.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE es.software_id = $1
      ORDER BY es.assigned_date DESC
    `, [id]);

    res.json({
      software: softwareResult.rows[0],
      assignments: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching software assignments:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.assign = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, notes } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        error: 'Employee ID is required',
        type: 'validation_error'
      });
    }

    // Check if software exists and has available licenses
    const softwareResult = await db.query(`
      SELECT s.name, s.max_licenses, COUNT(es.employee_id) as current_assignments
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.max_licenses
    `, [id]);

    if (softwareResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Software not found',
        type: 'not_found'
      });
    }

    const software = softwareResult.rows[0];
    const maxLicenses = parseInt(software.max_licenses) || 1;
    const currentAssignments = parseInt(software.current_assignments) || 0;

    if (currentAssignments >= maxLicenses) {
      return res.status(400).json({
        error: `No licenses available for ${software.name}. All ${maxLicenses} licenses are currently assigned.`,
        type: 'no_licenses_available',
        software_name: software.name,
        max_licenses: maxLicenses,
        current_assignments: currentAssignments
      });
    }

    // Get employee details
    const employeeResult = await db.query(`
      SELECT e.name, e.cep, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE e.id = $1
    `, [employee_id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Employee not found',
        type: 'not_found'
      });
    }

    const employee = employeeResult.rows[0];

    // Create assignment
    await db.query(`
      INSERT INTO employee_software (software_id, employee_id, assigned_date, notes)
      VALUES ($1, $2, CURRENT_DATE, $3)
    `, [id, employee_id, notes || null]);

    res.json({
      success: true,
      message: `${software.name} successfully assigned to ${employee.name} (${employee.cep})`,
      assignment: {
        software_name: software.name,
        employee_name: employee.name,
        employee_cep: employee.cep,
        department_name: employee.department_name
      }
    });
  } catch (error) {
    console.error('Error assigning software:', error);
    res.status(500).json({
      error: 'Server error occurred while assigning software',
      type: 'server_error'
    });
  }
};

exports.unassign = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id } = req.body;

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Remove assignment
    const result = await db.query(`
      DELETE FROM employee_software
      WHERE software_id = $1 AND employee_id = $2
    `, [id, employee_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unassigning software:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.export = async (req, res) => {
  // Implementation for exporting software list
  try {
    const software = await db.query(`
      SELECT
        s.name,
        s.version,
        s.vendor,
        s.license_type,
        s.cost_per_license,
        s.max_licenses,
        COUNT(es.employee_id) as current_assignments
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      GROUP BY s.id, s.name, s.version, s.vendor, s.license_type, s.cost_per_license, s.max_licenses
      ORDER BY s.name
    `);

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="software-list.csv"');

    // CSV headers
    let csv = 'Name,Version,Vendor,License Type,Cost per License,Max Licenses,Current Assignments,Available\n';

    // Add data rows
    software.rows.forEach(sw => {
      const available = (parseInt(sw.max_licenses) || 1) - (parseInt(sw.current_assignments) || 0);
      csv += `"${sw.name}","${sw.version || ''}","${sw.vendor || ''}","${sw.license_type || ''}","${sw.cost_per_license || ''}","${sw.max_licenses || 1}","${sw.current_assignments || 0}","${available}"\n`;
    });

    res.send(csv);
  } catch (error) {
    console.error('Error exporting software:', error);
    res.status(500).send('Error exporting software list');
  }
};
