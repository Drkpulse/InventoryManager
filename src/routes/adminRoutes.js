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
router.get('/warranty', hasPermission('admin.settings'), adminController.warrantyPage);

// CEP ID availability check endpoint
router.post('/check-cep-availability', isAuthenticated, async (req, res) => {
  try {
    const { cep_id, exclude_user_id } = req.body;

    if (!cep_id || cep_id.trim() === '') {
      return res.json({ available: false, error: 'CEP ID is required' });
    }

    let query = 'SELECT id FROM users WHERE cep_id = $1';
    let params = [cep_id.trim()];

    // Exclude current user from check if editing
    if (exclude_user_id) {
      query += ' AND id != $2';
      params.push(exclude_user_id);
    }

    const result = await db.query(query, params);

    res.json({
      available: result.rows.length === 0,
      cep_id: cep_id.trim()
    });

  } catch (error) {
    console.error('Error checking CEP ID availability:', error);
    res.status(500).json({
      available: false,
      error: 'Server error while checking availability'
    });
  }
});

module.exports = router;
