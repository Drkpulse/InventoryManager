const db = require('../config/db');

exports.getAllDepartments = async (req, res) => {
  try {
    // Get departments with employee counts
    const result = await db.query(`
      SELECT d.*, COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.dept_id AND e.left_date IS NULL
      GROUP BY d.id
      ORDER BY d.name
    `);

    res.render('layout', {
      title: 'Departments',
      body: 'departments/index',
      departments: result.rows,
      user: req.session.user,
      isDepartmentPage: true
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

    // Get employees in department (removed platform reference)
    const employeesResult = await db.query(`
      SELECT e.*, l.name as location_name
      FROM employees e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.dept_id = $1 AND e.left_date IS NULL
      ORDER BY e.name
    `, [id]);

    res.render('layout', {
      title: deptResult.rows[0].name + ' Department',
      body: 'departments/show',
      department: deptResult.rows[0],
      employees: employeesResult.rows,
      user: req.session.user,
      isDepartmentPage: true
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
    user: req.session.user,
    isDepartmentPage: true
  });
};

// Update the createDepartment function
exports.createDepartment = async (req, res) => {
  try {
    console.log('Department creation - Request body:', req.body);

    const { name } = req.body;

    // Enhanced validation
    if (!name || name.trim() === '') {
      console.log('Department validation failed: Name is empty');

      if (req.isAjax) {
        return res.json({
          success: false,
          message: 'Department name is required'
        });
      }

      return res.render('layout', {
        title: 'Add New Department',
        body: 'departments/create',
        error: 'Department name is required',
        user: req.session.user,
        isDepartmentPage: true
      });
    }

    console.log('Creating department with name:', name.trim());

    const result = await db.query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    console.log('Department created successfully:', result.rows[0]);

    if (req.isAjax) {
      return res.json({
        success: true,
        department: result.rows[0],
        message: 'Department created successfully'
      });
    }

    res.redirect('/departments');
  } catch (error) {
    console.error('Error creating department:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      if (req.isAjax) {
        return res.json({
          success: false,
          message: 'A department with this name already exists'
        });
      }

      return res.render('layout', {
        title: 'Add New Department',
        body: 'departments/create',
        error: 'A department with this name already exists',
        user: req.session.user,
        isDepartmentPage: true
      });
    }

    if (req.isAjax) {
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }

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
      user: req.session.user,
      isDepartmentPage: true
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).send('Server error');
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE departments SET name = $1 WHERE id = $2', [name, id]);

    res.redirect('/departments');
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are employees in this department
    const employeeCheck = await db.query('SELECT COUNT(*) as count FROM employees WHERE dept_id = $1', [id]);

    if (parseInt(employeeCheck.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete department: There are employees assigned to this department');
    }

    await db.query('DELETE FROM departments WHERE id = $1', [id]);

    res.redirect('/departments');
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).send('Server error');
  }
};
