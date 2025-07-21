const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/assets-by-department', isAuthenticated, reportController.assetsByDepartment);
router.get('/unassigned-assets', isAuthenticated, reportController.unassignedAssets);
router.get('/purchase-history', isAuthenticated, reportController.assetPurchaseHistory);
router.get('/export-assets', isAuthenticated, reportController.exportAssetsCSV);

module.exports = router;
