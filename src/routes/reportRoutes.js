const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { isAuthenticated } = require('../middleware/auth');

// Main reports page
router.get('/', isAuthenticated, (req, res) => {
  res.render('layout', {
    title: 'Reports',
    body: 'reports/index',
    user: req.session.user,
    isReportPage: true
  });
});

// Asset analytics report
router.get('/assets', isAuthenticated, reportController.assetsReport);

// Unassigned assets report
router.get('/unassigned-assets', isAuthenticated, reportController.unassignedAssets);

// Purchase history report
router.get('/purchase-history', isAuthenticated, reportController.assetPurchaseHistory);

// Assets by department
router.get('/assets-by-department', isAuthenticated, reportController.assetsByDepartment);

// Assets by employee
router.get('/assets-by-employee', isAuthenticated, reportController.assetsByEmployee);

// Export routes
router.get('/export-assets', isAuthenticated, reportController.exportAssetsCSV);
router.get('/assets/export', isAuthenticated, reportController.exportAssetsCSV);

module.exports = router;
