const db = require('../config/db');
const historyLogger = require('../utils/historyLogger');

exports.getAllEmployees = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, d.name as department_name,
             l.name as location_name,
             STRING_AGG(s.name, ', ') as software_list,
             COUNT(DISTINCT es.software_id) as software_count,
             COUNT(DISTINCT i.id) as assigned_items_count
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN employee_software es ON e.id = es.employee_id
      LEFT JOIN software s ON es.software_id = s.id
      LEFT JOIN items i ON e.id = i.assigned_to
      GROUP BY e.id, d.name, l.name
      ORDER BY e.name
    `);

    // Get departments and locations for filters
    const departments = await db.query('SELECT * FROM departments ORDER BY name');
    const locations = await db.query('SELECT * FROM locations ORDER BY name');

    res.render('layout', {
      title: 'Employees',
      body: 'employees/index',
      employees: result.rows,
      departments: departments.rows,
      locations: locations.rows,
      user: req.session.user,
      showDeletedMessage: req.query.deleted === 'true'
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).send('Server error');
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee details with all necessary joins
    const employeeResult = await db.query(`
      SELECT e.*, d.name as department_name,
             l.name as location_name, l.address as location_address
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
      SELECT i.*, t.name as type_name, b.name as brand_name,
             s.name as status_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.assigned_to = $1
      ORDER BY i.date_assigned DESC
    `, [id]);

    // Get assigned software
    const softwareResult = await db.query(`
      SELECT s.*, es.assigned_date, es.license_key, es.notes,
             s.license_type, s.cost_per_license, s.vendor
      FROM employee_software es
      JOIN software s ON es.software_id = s.id
      WHERE es.employee_id = $1
      ORDER BY es.assigned_date DESC
    `, [id]);

    res.render('layout', {
      title: 'Employee Details',
      body: 'employees/show',
      employee: employeeResult.rows[0],
      items: itemsResult.rows,
      software: softwareResult.rows,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).send('Server error');
  }
};

exports.createEmployeeForm = async (req, res) => {
  try {
    // Get departments for dropdown
    const departments = await db.query('SELECT * FROM departments ORDER BY name');

    // Get locations for dropdown
    const locations = await db.query('SELECT * FROM locations ORDER BY name');

    // Get software for dropdown
    const software = await db.query('SELECT * FROM software ORDER BY name');

    res.render('layout', {
      title: 'Add New Employee',
      body: 'employees/create',
      departments: departments.rows,
      locations: locations.rows,
      software: software.rows,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching data for employee form:', error);
    res.status(500).send('Server error');
  }
};

exports.createEmployee = async (req, res) => {
  const client = await db.getClient();

  try {
    const {
      name, cep, email, location_id, dept_id, joined_date,
      software_assignments // Array of software IDs
    } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO employees
      (name, cep, email, location_id, dept_id, joined_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [name, cep, email, location_id, dept_id, joined_date]);

    const employeeId = result.rows[0].id;

    // Handle software assignments
    const assignedSoftware = [];
    if (software_assignments && Array.isArray(software_assignments)) {
      for (const softwareId of software_assignments) {
        if (softwareId) {
          await client.query(`
            INSERT INTO employee_software (employee_id, software_id, assigned_date)
            VALUES ($1, $2, CURRENT_DATE)
          `, [employeeId, softwareId]);

          // Get software name for history
          const softwareResult = await client.query('SELECT name FROM software WHERE id = $1', [softwareId]);
          if (softwareResult.rows.length > 0) {
            assignedSoftware.push(softwareResult.rows[0].name);
          }
        }
      }
    }

    // Log the creation in history
    try {
      await historyLogger.logEmployeeHistory(
        employeeId,
        'created',
        {
          name,
          cep,
          email,
          location_id,
          dept_id,
          joined_date,
          software_assigned: assignedSoftware,
          created_by: req.session.user.name
        },
        req.session.user.id
      );
    } catch (historyError) {
      console.error('Failed to log history, but employee was created:', historyError);
    }

    await client.query('COMMIT');
    res.redirect(`/employees/${employeeId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating employee:', error);

    if (error.code === '23505') {
      return res.status(400).send('Email or CEP already exists');
    }

    if (error.code === '23503') {
      return res.status(400).send('Invalid reference: Check department or location');
    }

    res.status(500).send('Server error');
  } finally {
    client.release();
  }
};

exports.updateEmployeeForm = async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee data
    const employeeResult = await db.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).send('Employee not found');
    }

    // Get departments for dropdown
    const departments = await db.query('SELECT * FROM departments ORDER BY name');

    // Get locations for dropdown
    const locations = await db.query('SELECT * FROM locations ORDER BY name');

    // Get software for dropdown
    const software = await db.query('SELECT * FROM software ORDER BY name');

    // Get currently assigned software
    const assignedSoftware = await db.query(`
      SELECT software_id FROM employee_software WHERE employee_id = $1
    `, [id]);

    const assignedSoftwareIds = assignedSoftware.rows.map(row => row.software_id);

    res.render('layout', {
      title: 'Edit Employee',
      body: 'employees/edit',
      employee: employeeResult.rows[0],
      departments: departments.rows,
      locations: locations.rows,
      software: software.rows,
      assignedSoftwareIds: assignedSoftwareIds,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching employee for edit:', error);
    res.status(500).send('Server error');
  }
};

exports.updateEmployee = async (req, res) => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const {
      name, cep, email, location_id, dept_id, joined_date, left_date,
      software_assignments
    } = req.body;

    await client.query('BEGIN');

    // Get original employee data for comparison
    const originalEmployee = await client.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (originalEmployee.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send('Employee not found');
    }

    // Get original software assignments
    const originalSoftwareResult = await client.query(`
      SELECT s.name, es.software_id
      FROM employee_software es
      JOIN software s ON es.software_id = s.id
      WHERE es.employee_id = $1
    `, [id]);
    const originalSoftware = originalSoftwareResult.rows;

    await client.query(`
      UPDATE employees SET
        name = $1,
        cep = $2,
        email = $3,
        location_id = $4,
        dept_id = $5,
        joined_date = $6,
        left_date = $7,
        updated_at = NOW()
      WHERE id = $8
    `, [name, cep, email, location_id, dept_id, joined_date, left_date || null, id]);

    // Update software assignments
    // First, remove all existing assignments
    await client.query('DELETE FROM employee_software WHERE employee_id = $1', [id]);

    // Then add new assignments and track changes
    const newSoftware = [];
    if (software_assignments && Array.isArray(software_assignments)) {
      for (const softwareId of software_assignments) {
        if (softwareId) {
          await client.query(`
            INSERT INTO employee_software (employee_id, software_id, assigned_date)
            VALUES ($1, $2, CURRENT_DATE)
          `, [id, softwareId]);

          // Get software name for history
          const softwareResult = await client.query('SELECT name FROM software WHERE id = $1', [softwareId]);
          if (softwareResult.rows.length > 0) {
            newSoftware.push(softwareResult.rows[0].name);
          }
        }
      }
    }

    // Log what has changed
    const changes = {};
    const fields = ['name', 'cep', 'email', 'location_id', 'dept_id', 'joined_date', 'left_date'];

    for (const field of fields) {
      const oldValue = originalEmployee.rows[0][field];
      const newValue = req.body[field] || null;

      if (field.includes('date') && oldValue && newValue) {
        const oldDate = new Date(oldValue).toISOString().split('T')[0];
        const newDate = new Date(newValue).toISOString().split('T')[0];
        if (oldDate !== newDate) {
          changes[field] = { from: oldDate, to: newDate };
        }
      } else if (oldValue != newValue) {
        changes[field] = { from: oldValue, to: newValue };
      }
    }

    // Track software changes
    const oldSoftwareNames = originalSoftware.map(s => s.name);
    const addedSoftware = newSoftware.filter(s => !oldSoftwareNames.includes(s));
    const removedSoftware = oldSoftwareNames.filter(s => !newSoftware.includes(s));

    if (addedSoftware.length > 0 || removedSoftware.length > 0) {
      changes.software_changes = {
        added: addedSoftware,
        removed: removedSoftware,
        current: newSoftware
      };
    }

    changes.updated_by = req.session.user.name;

    if (Object.keys(changes).length > 0) {
      try {
        await historyLogger.logEmployeeHistory(
          id,
          'updated',
          changes,
          req.session.user.id
        );
      } catch (historyError) {
        console.error('Failed to log history:', historyError);
      }
    }

    await client.query('COMMIT');
    res.redirect(`/employees/${id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating employee:', error);

    if (error.code === '23505') {
      return res.status(400).send('Email or CEP already exists');
    }

    if (error.code === '23503') {
      return res.status(400).send('Invalid reference: Check department or location');
    }

    res.status(500).send('Server error');
  } finally {
    client.release();
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user wants to unassign items first
    if (req.isAjax) {
      // Check for assigned items
      const itemsResult = await db.query(`
        SELECT i.cep_brc, i.name, t.name as type_name
        FROM items i
        LEFT JOIN types t ON i.type_id = t.id
        WHERE i.assigned_to = $1
      `, [id]);

      return res.json({
        hasAssignedItems: itemsResult.rows.length > 0,
        items: itemsResult.rows
      });
    }

    // Direct deletion without unassigning
    await db.query('DELETE FROM employees WHERE id = $1', [id]);
    return res.redirect('/employees');
  } catch (error) {
    console.error('Error deleting employee:', error);

    if (req.isAjax) {
      return res.status(500).json({ error: 'Server error: ' + error.message });
    }

    res.status(500).send('Server error');
  }
};

exports.unassignAndDeleteEmployee = async (req, res) => {
  const client = await db.getClient();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Get employee info for history logging
    const employeeResult = await client.query(`
      SELECT name, cep FROM employees WHERE id = $1
    `, [id]);

    if (employeeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get all items assigned to this employee for history
    const itemsResult = await client.query(`
      SELECT i.id, i.cep_brc, i.name, t.name as type_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      WHERE i.assigned_to = $1
    `, [id]);

    // Get assigned software for history
    const softwareResult = await client.query(`
      SELECT s.name
      FROM employee_software es
      JOIN software s ON es.software_id = s.id
      WHERE es.employee_id = $1
    `, [id]);

    // Unassign all items
    await client.query(`
      UPDATE items
      SET assigned_to = NULL, date_assigned = NULL, updated_at = NOW()
      WHERE assigned_to = $1
    `, [id]);

    // Log history for each item
    for (const item of itemsResult.rows) {
      try {
        await historyLogger.logItemHistory(
          item.id,
          'unassigned',
          {
            employee_id: id,
            employee_name: employee.name,
            employee_cep: employee.cep,
            reason: 'Employee deleted'
          },
          req.session.user.id
        );
      } catch (historyError) {
        console.error(`Failed to log history for item ${item.cep_brc}:`, historyError);
      }
    }

    // Log employee deletion with summary of what was unassigned
    try {
      await historyLogger.logEmployeeHistory(
        id,
        'deleted',
        {
          employee_name: employee.name,
          employee_cep: employee.cep,
          items_unassigned: itemsResult.rows.map(item => ({
            cep_brc: item.cep_brc,
            name: item.name,
            type: item.type_name
          })),
          software_removed: softwareResult.rows.map(s => s.name),
          deleted_by: req.session.user.name,
          deletion_reason: 'Employee termination'
        },
        req.session.user.id
      );
    } catch (historyError) {
      console.error('Failed to log employee deletion history:', historyError);
    }

    // Remove software assignments (cascade will handle this, but let's be explicit)
    await client.query('DELETE FROM employee_software WHERE employee_id = $1', [id]);

    // Delete the employee
    await client.query('DELETE FROM employees WHERE id = $1', [id]);

    await client.query('COMMIT');

    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error unassigning and deleting employee:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  } finally {
    client.release();
  }
};

exports.getEmployeeHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the employee details
    const employeeResult = await db.query(`
      SELECT e.*,
             d.name as department_name,
             l.name as location_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.id = $1
    `, [id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).send('Employee not found');
    }

    // Get the comprehensive employee history (including related items)
    const history = await historyLogger.getEmployeeHistory(id);

    // Helper functions for the view
    const formatActionType = (actionType, historyType) => {
      const typeMap = {
        'created': 'Employee Created',
        'updated': 'Employee Updated',
        'deleted': 'Employee Deleted',
        'assigned': historyType === 'item' ? 'Item Assigned' : 'Software Assigned',
        'unassigned': historyType === 'item' ? 'Item Unassigned' : 'Software Unassigned'
      };
      return typeMap[actionType] || actionType.charAt(0).toUpperCase() + actionType.slice(1);
    };

    const formatFieldName = (field) => {
      const fieldMap = {
        'name': 'Name',
        'cep': 'Employee ID',
        'email': 'Email',
        'dept_id': 'Department',
        'location_id': 'Location',
        'joined_date': 'Joined Date',
        'left_date': 'Left Date',
        'software_changes': 'Software Changes'
      };
      return fieldMap[field] || field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
    };

    const formatFieldValue = (value) => {
      if (value === null || value === undefined) return 'None';
      if (value instanceof Date) return value.toLocaleDateString();
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return value;
    };

    res.render('layout', {
      title: 'Employee History',
      body: 'employees/history',
      employee: employeeResult.rows[0],
      history: history,
      formatActionType,
      formatFieldName,
      formatFieldValue,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching employee history:', error);
    res.status(500).send('Server error');
  }
};

// In your employee controller, add pagination logic similar to items controller
exports.getEmployees = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 25;
    const offset = (page - 1) * perPage;

    // Build query conditions based on filters
    let conditions = [];
    let params = [];
    let paramCount = 1;

    // Add filter conditions here based on req.query

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total employees
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalEmployees = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalEmployees / perPage);

    // Get employees with pagination
    const employeesQuery = `
      SELECT e.*, d.name as department_name, l.name as location_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON e.location_id = l.id
      ${whereClause}
      ORDER BY
        CASE WHEN e.left_date IS NULL THEN 0 ELSE 1 END,
        e.name
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(perPage, offset);
    const employeesResult = await db.query(employeesQuery, params);

    // Get departments and locations for filters
    const departments = await db.query('SELECT id, name FROM departments ORDER BY name');
    const locations = await db.query('SELECT id, name FROM locations ORDER BY name');

    res.render('layout', {
      title: 'Employees',
      body: 'employees/index',
      employees: employeesResult.rows,
      departments: departments.rows,
      locations: locations.rows,
      currentPage: page,
      totalPages,
      totalEmployees,
      perPage,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).send('Server error');
  }
};
