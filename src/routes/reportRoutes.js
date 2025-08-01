const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { hasPermission } = require('../middleware/permissions');

// Main reports page
router.get('/', hasPermission('reports.view'), (req, res) => {
  res.render('layout', {
    title: 'Reports',
    body: 'reports/index',
    user: req.session.user,
    isReportPage: true
  });
});

// Asset analytics report
router.get('/assets', hasPermission('reports.view'), reportController.assetsReport);

// Unassigned assets report
router.get('/unassigned-assets', hasPermission('reports.view'), reportController.unassignedAssets);

// Purchase history report
router.get('/purchase-history', hasPermission('reports.view'), reportController.assetPurchaseHistory);

// Assets by department
router.get('/assets-by-department', hasPermission('reports.view'), reportController.assetsByDepartment);

// Assets by employee
router.get('/assets-by-employee', hasPermission('reports.view'), reportController.assetsByEmployee);

// Export routes
router.get('/export-assets', hasPermission('reports.export'), reportController.exportAssetsCSV);
router.get('/assets/export', hasPermission('reports.export'), reportController.exportAssetsCSV);

router.get('/employee-full-assets/:id', hasPermission('reports.export'), reportController.employeeFullAssetsPDF);

module.exports = router;
