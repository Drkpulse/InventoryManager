const db = require('../config/db');

exports.getAllDepartments = async (req, res) => {
  try {
    // Get departments with employee counts
    const result = await db.query(`
      SELECT d.*, COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.dept_id
      GROUP BY d.id
      ORDER BY d.name
    `);

    res.render('layout', {
      title: 'Departments',
      body: 'departments/index',
      departments: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).send('Server error');
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get department details
    const deptResult = await db.query('SELECT * FROM departments WHERE id = $1', [id]);

    if (deptResult.rows.length === 0) {
      return res.status(404).send('Department not found');
    }

    // Get employees in department
    const employeesResult = await db.query(`
      SELECT e.*, p.name as platform_name
      FROM employees e
      LEFT JOIN platforms p ON e.platform_id = p.id
      WHERE e.dept_id = $1
      ORDER BY e.name
    `, [id]);

    res.render('layout', {
      title: deptResult.rows[0].name + ' Department',
      body: 'departments/show',
      department: deptResult.rows[0],
      employees: employeesResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).send('Server error');
  }
};

exports.createDepartmentForm = (req, res) => {
  res.render('layout', {
    title: 'Add New Department',
    body: 'departments/create',
    user: req.session.user
  });
};

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    const result = await db.query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING id',
      [name]
    );

    res.redirect(`/departments/${result.rows[0].id}`);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).send('Server error');
  }
};

exports.updateDepartmentForm = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM departments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Department not found');
    }

    res.render('layout', {
      title: 'Edit Department',
      body: 'departments/edit',
      department: result.rows[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching department for edit:', error);
    res.status(500).send('Server error');
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE departments SET name = $1 WHERE id = $2', [name, id]);

    res.redirect(`/departments/${id}`);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department has employees
    const empCheck = await db.query('SELECT COUNT(*) FROM employees WHERE dept_id = $1', [id]);

    if (parseInt(empCheck.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete department with employees');
    }

    await db.query('DELETE FROM departments WHERE id = $1', [id]);

    res.redirect('/departments');
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).send('Server error');
  }
};
