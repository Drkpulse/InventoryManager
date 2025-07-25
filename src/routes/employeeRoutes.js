const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Add this missing import
const employeeController = require('../controllers/employeeController');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Routes
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Extract query parameters for filtering and pagination
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 25;
    const offset = (page - 1) * perPage;

    // Extract filter parameters
    const departmentFilter = req.query.department;
    const locationFilter = req.query.location;
    const statusFilter = req.query.status || 'active';
    const joinedDateFrom = req.query.joinedDateFrom;
    const joinedDateTo = req.query.joinedDateTo;
    const searchTerm = req.query.search;

    // Build WHERE clause dynamically
    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    // Status filter - show only active employees by default
    if (statusFilter === 'active') {
      whereConditions.push(`e.left_date IS NULL`);
    } else if (statusFilter === 'inactive') {
      whereConditions.push(`e.left_date IS NOT NULL`);
    }
    // If statusFilter is empty, show all employees

    // Department filter
    if (departmentFilter) {
      whereConditions.push(`e.dept_id = $${paramCount}`);
      params.push(departmentFilter);
      paramCount++;
    }

    // Location filter
    if (locationFilter) {
      whereConditions.push(`e.location_id = $${paramCount}`);
      params.push(locationFilter);
      paramCount++;
    }

    // Date range filter
    if (joinedDateFrom) {
      whereConditions.push(`e.joined_date >= $${paramCount}`);
      params.push(joinedDateFrom);
      paramCount++;
    }

    if (joinedDateTo) {
      whereConditions.push(`e.joined_date <= $${paramCount}`);
      params.push(joinedDateTo);
      paramCount++;
    }

    // Search filter
    if (searchTerm) {
      whereConditions.push(`(
        e.name ILIKE $${paramCount} OR
        e.cep ILIKE $${paramCount} OR
        e.email ILIKE $${paramCount} OR
        d.name ILIKE $${paramCount}
      )`);
      params.push(`%${searchTerm}%`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total employees for pagination
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
      currentFilters: req.query,
      showDeletedMessage: req.query.deleted === 'true',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch employees',
      user: req.session.user
    });
  }
});

router.get('/new', isAuthenticated, employeeController.createEmployeeForm);
router.post('/', isAuthenticated, employeeController.createEmployee);
router.get('/:id', isAuthenticated, employeeController.getEmployeeById);
router.get('/:id/edit', isAuthenticated, employeeController.updateEmployeeForm);
router.post('/:id', isAuthenticated, employeeController.updateEmployee);
router.post('/:id/delete', isAuthenticated, employeeController.deleteEmployee);
router.post('/:id/unassign-and-delete', isAuthenticated, employeeController.unassignAndDeleteEmployee);
router.get('/:id/history', isAuthenticated, employeeController.getEmployeeHistory);

module.exports = router;
