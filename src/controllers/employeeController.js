const db = require('../config/db');

exports.getAllEmployees = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, d.name as department_name, p.name as platform_name, o.name as office_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN platforms p ON e.platform_id = p.id
      LEFT JOIN offices o ON e.office_id = o.id
      ORDER BY e.name
    `);

    res.render('layout', {
      title: 'Employees',
      body: 'employees/index',
      employees: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).send('Server error');
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee details
    const employeeResult = await db.query(`
      SELECT e.*, d.name as department_name, p.name as platform_name, o.name as office_name
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
      ORDER BY i.date_assigned DESC
    `, [id]);

    res.render('layout', {
      title: 'Employee Details',
      body: 'employees/show',
      employee: employeeResult.rows[0],
      items: itemsResult.rows,
      user: req.session.user
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

    // Get platforms for dropdown
    const platforms = await db.query('SELECT * FROM platforms ORDER BY name');

    // Get office software for dropdown
    const offices = await db.query('SELECT * FROM offices ORDER BY name');

    res.render('layout', {
      title: 'Add New Employee',
      body: 'employees/create',
      departments: departments.rows,
      platforms: platforms.rows,
      offices: offices.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching data for employee form:', error);
    res.status(500).send('Server error');
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const {
      name, cep, email, office_id, platform_id,
      dept_id, joined_date
    } = req.body;

    const result = await db.query(`
      INSERT INTO employees
      (name, cep, email, office_id, platform_id, dept_id, joined_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [name, cep, email, office_id, platform_id, dept_id, joined_date]);

    res.redirect(`/employees/${result.rows[0].id}`);
  } catch (error) {
    console.error('Error creating employee:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).send('Email or CEP already exists');
    }

    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).send('Invalid reference: Check department, platform, or office');
    }

    res.status(500).send('Server error');
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

    // Get platforms for dropdown
    const platforms = await db.query('SELECT * FROM platforms ORDER BY name');

    // Get office software for dropdown
    const offices = await db.query('SELECT * FROM offices ORDER BY name');

    res.render('layout', {
      title: 'Edit Employee',
      body: 'employees/edit',
      employee: employeeResult.rows[0],
      departments: departments.rows,
      platforms: platforms.rows,
      offices: offices.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching employee for edit:', error);
    res.status(500).send('Server error');
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, cep, email, office_id, platform_id,
      dept_id, joined_date, left_date
    } = req.body;

    await db.query(`
      UPDATE employees SET
        name = $1,
        cep = $2,
        email = $3,
        office_id = $4,
        platform_id = $5,
        dept_id = $6,
        joined_date = $7,
        left_date = $8,
        updated_at = NOW()
      WHERE id = $9
    `, [name, cep, email, office_id, platform_id, dept_id, joined_date, left_date || null, id]);

    res.redirect(`/employees/${id}`);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee has assigned items
    const itemsCheck = await db.query('SELECT COUNT(*) FROM items WHERE assigned_to = $1', [id]);

    if (parseInt(itemsCheck.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete employee with assigned items. Please reassign items first.');
    }

    await db.query('DELETE FROM employees WHERE id = $1', [id]);

    res.redirect('/employees');
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).send('Server error');
  }
};
