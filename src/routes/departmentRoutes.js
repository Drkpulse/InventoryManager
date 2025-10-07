const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { hasPermission } = require('../middleware/permissions');

// Department Management Permissions:
// departments.view, departments.create, departments.edit, departments.delete

router.get('/', hasPermission('departments.view'), departmentController.getAllDepartments);
router.get('/new', hasPermission('departments.create'), departmentController.createDepartmentForm);
router.post('/', hasPermission('departments.create'), departmentController.createDepartment);
router.get('/:id', hasPermission('departments.view'), departmentController.getDepartmentById);
router.get('/:id/edit', hasPermission('departments.edit'), departmentController.updateDepartmentForm);
router.post('/:id', hasPermission('departments.edit'), departmentController.updateDepartment);
router.post('/:id/delete', hasPermission('departments.delete'), departmentController.deleteDepartment);

module.exports = router;
