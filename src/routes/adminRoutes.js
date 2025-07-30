// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { hasPermission, hasAnyPermission } = require('../middleware/permissions');

// All admin routes require authentication
router.use(isAuthenticated);

// User Management Routes
router.get('/users', hasPermission('users.view'), adminController.users);
router.get('/users/add', hasPermission('users.create'), adminController.showAddUserForm);
router.post('/users/add', hasPermission('users.create'), adminController.addUser);
router.get('/users/:id/edit', hasPermission('users.edit'), adminController.showEditUserForm);
router.post('/users/:id/edit', hasPermission('users.edit'), adminController.editUser);
router.post('/users/:id/delete', hasPermission('users.delete'), adminController.deleteUser);

// Role Management Routes
router.get('/roles', hasPermission('roles.view'), adminController.roles);
router.get('/roles/add', hasPermission('roles.create'), adminController.showAddRoleForm);
router.post('/roles/add', hasPermission('roles.create'), adminController.addRole);
router.get('/roles/:id/edit', hasPermission('roles.edit'), adminController.showEditRoleForm);
router.post('/roles/:id/edit', hasPermission('roles.edit'), adminController.editRole);
router.post('/roles/:id/delete', hasPermission('roles.delete'), adminController.deleteRole);

// Permission Management Routes
router.get('/permissions', hasAnyPermission(['roles.view', 'roles.edit']), adminController.permissions);

// System Settings
router.get('/settings', hasPermission('admin.settings'), adminController.settings);
router.post('/settings', hasPermission('admin.settings'), adminController.updateSettings);

// Activity Logs
router.get('/logs', hasPermission('admin.logs'), adminController.logs);
router.get('/dashboard', hasPermission('admin.settings'), adminController.adminDashboard);

module.exports = router;
