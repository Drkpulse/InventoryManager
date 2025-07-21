const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/', isAuthenticated, departmentController.getAllDepartments);
router.get('/new', isAuthenticated, departmentController.createDepartmentForm);
router.post('/', isAuthenticated, departmentController.createDepartment);
router.get('/:id', isAuthenticated, departmentController.getDepartmentById);
router.get('/:id/edit', isAuthenticated, departmentController.updateDepartmentForm);
router.post('/:id', isAuthenticated, departmentController.updateDepartment);
router.post('/:id/delete', isAuthenticated, departmentController.deleteDepartment);

module.exports = router;
