const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// All admin routes require authentication
router.use(isAuthenticated);

// All admin routes also require admin role
router.use(isAdmin);

// User Management
router.get('/users', adminController.users);
router.get('/users/add', adminController.showAddUserForm);
router.post('/users/add', adminController.addUser);
router.get('/users/:id/edit', adminController.showEditUserForm);
router.post('/users/:id/edit', adminController.editUser);
router.post('/users/:id/delete', adminController.deleteUser);

// System Settings
router.get('/settings', adminController.settings);
router.post('/settings', adminController.updateSettings);

// Activity Logs
router.get('/logs', adminController.logs);

module.exports = router;
