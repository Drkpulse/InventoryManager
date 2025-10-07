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
router.post('/users/:id/unlock', hasPermission('users.edit'), adminController.unlockUser);

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

// Security Management Routes
router.get('/security', hasAnyPermission(['admin.security', 'admin.logs', 'admin.settings']), adminController.securityCenter);
router.get('/security/logs', hasAnyPermission(['admin.security', 'admin.logs']), adminController.securityLogs);
router.get('/security/events', hasAnyPermission(['admin.security', 'admin.logs']), adminController.securityEvents);
router.get('/security/lockouts', hasAnyPermission(['admin.security', 'users.edit']), adminController.accountLockouts);
router.post('/security/unlock-account', hasAnyPermission(['admin.security', 'users.edit']), adminController.unlockAccount);
router.post('/security/clear-attempts', hasAnyPermission(['admin.security', 'users.edit']), adminController.clearLoginAttempts);
router.get('/security/sessions', hasAnyPermission(['admin.security', 'admin.settings']), adminController.activeSessions);
router.post('/security/kill-session', hasAnyPermission(['admin.security', 'admin.settings']), adminController.killSession);

// Activity Logs
router.get('/logs', hasPermission('admin.logs'), adminController.logs);
router.get('/logs/export', hasPermission('admin.logs'), adminController.exportLogs);
router.get('/warranty', hasPermission('admin.settings'), adminController.warrantyPage);

// Performance Monitoring
router.get('/performance', hasPermission('admin.settings'), adminController.performance);

// Database Tools
router.get('/database', hasPermission('admin.settings'), adminController.database);

// Database API endpoints
router.get('/database/stats', hasPermission('admin.settings'), adminController.getDatabaseStats);
router.get('/database/backups', hasPermission('admin.settings'), adminController.getDatabaseBackups);
router.get('/database/info', hasPermission('admin.settings'), adminController.getDatabaseInfo);
router.get('/database/tables', hasPermission('admin.settings'), adminController.getDatabaseTables);
router.post('/database/analyze', hasPermission('admin.settings'), adminController.analyzeDatabase);
router.post('/database/vacuum', hasPermission('admin.settings'), adminController.vacuumDatabase);
router.post('/database/reindex', hasPermission('admin.settings'), adminController.reindexDatabase);

// User Analytics API endpoints
router.get('/analytics/users', hasPermission('admin.settings'), adminController.getUserAnalytics);

// Database Backup Routes
router.get('/backups', hasPermission('admin.settings'), adminController.backups);

router.post('/backups/create', hasPermission('admin.settings'), async (req, res) => {
  try {
    const backupScheduler = require('../services/backupScheduler');
    const backupFile = await backupScheduler.createManualBackup();

    req.flash('success', `Manual backup created successfully: ${require('path').basename(backupFile)}`);
  } catch (error) {
    console.error('❌ Error creating manual backup:', error);
    req.flash('error', 'Failed to create manual backup');
  }

  res.redirect('/admin/backups');
});

// Download backup file
router.get('/backups/download/:filename', hasPermission('admin.settings'), async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');

    const filename = req.params.filename;
    const backupsDir = path.join(__dirname, '../../backups');
    const filePath = path.join(backupsDir, filename);

    // Security check: ensure the file is within the backups directory
    if (!filePath.startsWith(backupsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    console.log(`📥 Admin ${req.session.user.name} downloaded backup: ${filename}`);

  } catch (error) {
    console.error('❌ Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download backup file' });
  }
});

// Delete backup file
router.post('/backups/delete/:filename', hasPermission('admin.settings'), async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs').promises;

    const filename = req.params.filename;
    const backupsDir = path.join(__dirname, '../../backups');
    const filePath = path.join(backupsDir, filename);

    // Security check: ensure the file is within the backups directory
    if (!filePath.startsWith(backupsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    // Delete the file
    await fs.unlink(filePath);

    console.log(`🗑️  Admin ${req.session.user.name} deleted backup: ${filename}`);
    res.json({ success: true, message: `Backup ${filename} deleted successfully` });

  } catch (error) {
    console.error('❌ Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup file' });
  }
});

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
    console.log('🔍 Loading license management page...');

    // Ensure license table exists (fix database issues)
    await licenseValidator.ensureLicenseTable();

    // Get license validation info
    const licenseInfo = await licenseValidator.checkLicense();
    const currentLicense = await licenseValidator.getCurrentLicense();

    // Get database statistics and validation results
    let licenseStats = null;
    let validationResult = null;
    let dashboardData = null;

    try {
      // Get license statistics from database - try function first, then fallback
      try {
        const statsQuery = await db.query('SELECT * FROM get_license_statistics()');
        licenseStats = statsQuery.rows[0] || null;
        console.log('📊 License statistics loaded:', licenseStats);
      } catch (funcError) {
        // Fallback: Create basic statistics from license_config table
        const fallbackQuery = await db.query(`
          SELECT
            COUNT(*) as total_licenses,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_licenses,
            COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses,
            COUNT(CASE WHEN status = 'invalid' THEN 1 END) as invalid_licenses
          FROM license_config
        `);
        licenseStats = fallbackQuery.rows[0] || {
          total_licenses: 0,
          active_licenses: 0,
          expired_licenses: 0,
          invalid_licenses: 0,
          days_until_expiry: null
        };
        console.log('📊 Fallback license statistics loaded:', licenseStats);
      }
    } catch (error) {
      console.warn('⚠️  License statistics not available:', error.message);
      licenseStats = {
        total_licenses: 0,
        active_licenses: 0,
        expired_licenses: 0,
        invalid_licenses: 0,
        days_until_expiry: null
      };
    }

    try {
      // Get license validation results - try function first, then fallback
      try {
        const validationQuery = await db.query('SELECT * FROM validate_license_data()');
        validationResult = validationQuery.rows[0] || null;
        console.log('✅ License validation loaded:', validationResult);
      } catch (funcError) {
        // Fallback: Create basic validation from license_config table
        const fallbackQuery = await db.query(`
          SELECT
            'MANUAL' as validation_result,
            COUNT(*) as total_licenses,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_licenses,
            COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses,
            ARRAY[]::text[] as issues_found,
            NOW() as last_validation
          FROM license_config
        `);
        validationResult = fallbackQuery.rows[0] || null;
        console.log('✅ Fallback license validation loaded:', validationResult);
      }
    } catch (error) {
      console.warn('⚠️  License validation function not available:', error.message);
    }

    // Skip dashboard data as it's not essential
    dashboardData = [];

    res.render('layout', {
      title: 'License Management',
      body: 'admin/license',
      licenseInfo: licenseInfo,
      currentLicense: currentLicense,
      licenseStats: licenseStats,
      validationResult: validationResult,
      dashboardData: dashboardData,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error loading license information:', error);
    req.flash('error', 'Error loading license information: ' + error.message);
    res.redirect('/dashboard');
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
    const validationUrl = process.env.LICENSE_VALIDATION_URL || 'https://license.voidbyte.xyz/api/validate';

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

// Test license database functions
router.post('/license/test-database', isAuthenticated, isAdmin, adminController.testLicenseDatabase);

module.exports = router;
