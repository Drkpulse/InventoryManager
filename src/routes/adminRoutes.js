// src/routes/adminRoutes.js
const express = require('express');
const db = require('../config/db');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { hasPermission, hasAnyPermission } = require('../middleware/permissions');

// All admin routes require authentication
router.use(isAuthenticated);

// Import license validator
const { licenseValidator } = require('../middleware/licenseValidator');

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

    let query = 'SELECT id, name FROM users WHERE cep_id = $1';
    let params = [cep_id.trim()];

    // Exclude current user from check if editing
    if (exclude_user_id) {
      query += ' AND id != $2';
      params.push(exclude_user_id);
    }

    const result = await db.query(query, params);

    res.json({
      available: result.rows.length === 0,
      cep_id: cep_id.trim(),
      user: result.rows.length > 0 ? result.rows[0] : null
    });

  } catch (error) {
    console.error('Error checking CEP ID availability:', error);
    res.status(500).json({
      available: false,
      error: 'Server error while checking availability'
    });
  }
});

// License management routes - only accessible by admin
router.get('/license', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const licenseInfo = await licenseValidator.checkLicense();
    const currentLicense = await licenseValidator.getCurrentLicense();

    res.render('layout', {
      title: 'License Management',
      body: 'admin/licanse',
      licenseInfo: licenseInfo,
      currentLicense: currentLicense,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error loading license information:', error);
    req.flash('error', 'Error loading license information');
    res.redirect('/');
  }
});

router.post('/license/validate', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey || !licenseKey.trim()) {
      req.flash('error', 'License key is required');
      return res.redirect('/admin/license');
    }

    const trimmedKey = licenseKey.trim();
    console.log('🔍 Validating license key:', trimmedKey.substring(0, 10) + '...');

    const licenseInfo = await licenseValidator.validateLicense(trimmedKey);

    if (licenseInfo.status === 'active') {
      req.flash('success', `License validated successfully for ${licenseInfo.company}. Valid until ${licenseInfo.valid_until}`);
    } else {
      req.flash('error', `License validation failed: ${licenseInfo.msg}`);
    }

    res.redirect('/admin/license');
  } catch (error) {
    console.error('❌ License validation error:', error);
    req.flash('error', 'Error validating license key');
    res.redirect('/admin/license');
  }
});

router.post('/license/remove', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const success = await licenseValidator.removeLicense();

    if (success) {
      req.flash('info', 'License key removed successfully');
    } else {
      req.flash('error', 'Error removing license key');
    }

    res.redirect('/admin/license');
  } catch (error) {
    console.error('❌ Error removing license:', error);
    req.flash('error', 'Error removing license key');
    res.redirect('/admin/license');
  }
});

// Test license connection
router.post('/license/test', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Simple connectivity test
    const axios = require('axios');
    const validationUrl = process.env.LICENSE_VALIDATION_URL || 'https://your-license-server.com/api/validate';

    const response = await axios.get(validationUrl.replace('/validate', '/health'), {
      timeout: 5000
    });

    res.json({
      success: true,
      message: 'Connection test successful',
      status: response.status
    });
  } catch (error) {
    res.json({
      success: false,
      message: `Connection test failed: ${error.message}`
    });
  }
});

module.exports = router;
