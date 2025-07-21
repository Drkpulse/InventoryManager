const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/', isAuthenticated, employeeController.getAllEmployees);
router.get('/new', isAuthenticated, employeeController.createEmployeeForm);
router.post('/', isAuthenticated, employeeController.createEmployee);
router.get('/:id', isAuthenticated, employeeController.getEmployeeById);
router.get('/:id/edit', isAuthenticated, employeeController.updateEmployeeForm);
router.post('/:id', isAuthenticated, employeeController.updateEmployee);
router.post('/:id/delete', isAuthenticated, employeeController.deleteEmployee);

module.exports = router;
