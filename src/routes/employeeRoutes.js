const express = require('express');
const router = express.Router();
const db = require('../config/db');
const employeeController = require('../controllers/employeeController');
const { getEmployeeHistory } = require('../utils/historyLogger');
const { hasPermission } = require('../middleware/permissions');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Routes
router.get(
  '/',
  hasPermission('employees.view'),
  async (req, res) => {
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
        req,
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
  }
);

router.get('/new', hasPermission('employees.create'), employeeController.createEmployeeForm);
router.post('/', hasPermission('employees.create'), employeeController.createEmployee);
router.get('/:id', hasPermission('employees.view'), employeeController.getEmployeeById);
router.get('/:id/edit', hasPermission('employees.edit'), employeeController.updateEmployeeForm);
router.post('/:id', hasPermission('employees.edit'), employeeController.updateEmployee);
router.post('/:id/delete', hasPermission('employees.delete'), employeeController.deleteEmployee);
router.post('/:id/unassign-and-delete', hasPermission('employees.delete'), employeeController.unassignAndDeleteEmployee);
router.get(
  '/:id/history',
  hasPermission('employees.view'),
  async (req, res) => {
    try {
      const employeeId = req.params.id;

      // Fetch employee details
      const employeeResult = await db.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
      const employee = employeeResult.rows[0];

      if (!employee) {
        return res.status(404).render('layout', {
          title: 'Error',
          body: 'error',
          message: 'Employee not found',
          user: req.session.user
        });
      }

      // Fetch employee history - adjust the query as per your database schema
      const history = await getEmployeeHistory(employeeId); // Implement this function to fetch history

      // Fetch users for filter dropdowns, etc.
      const usersResult = await db.query('SELECT id, name FROM users ORDER BY name');
      const users = usersResult.rows;

      // Pagination logic
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;

      // Paginate history
      const paginatedHistory = history.slice((page - 1) * perPage, page * perPage);

      const profileChanges = history.filter(h => h.action_type === 'updated' && h.history_type === 'employee').length;
      const itemActivities = history.filter(h => h.history_type === 'item').length;

      res.render('employees/history', {
        employee,
        history,
        paginatedHistory,
        users,
        startIndex: (page - 1) * perPage,
        endIndex: Math.min(page * perPage, history.length),
        totalItems: history.length,
        currentPage: page,
        totalPages: Math.ceil(history.length / perPage),
        itemsPerPage: perPage,
        profileChanges,
        itemActivities,
        req,
        user: req.session.user
      });
    } catch (error) {
      console.error('Error fetching employee history:', error);
      res.status(500).render('layout', {
        title: 'Error',
        body: 'error',
        message: 'Could not fetch employee history',
        user: req.session.user
      });
    }
  }
);

module.exports = router;
