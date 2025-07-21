const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/referenceController');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Brand routes
router.get('/brands', isAuthenticated, referenceController.getAllBrands);
router.post('/brands', isAuthenticated, referenceController.createBrand);
router.post('/brands/:id', isAuthenticated, referenceController.updateBrand);
router.post('/brands/:id/delete', isAuthenticated, referenceController.deleteBrand);

// Type routes
router.get('/types', isAuthenticated, referenceController.getAllTypes);
router.post('/types', isAuthenticated, referenceController.createType);
router.post('/types/:id', isAuthenticated, referenceController.updateType);
router.post('/types/:id/delete', isAuthenticated, referenceController.deleteType);

// Platform routes
router.get('/platforms', isAuthenticated, referenceController.getAllPlatforms);
router.post('/platforms', isAuthenticated, referenceController.createPlatform);
router.post('/platforms/:id', isAuthenticated, referenceController.updatePlatform);
router.post('/platforms/:id/delete', isAuthenticated, referenceController.deletePlatform);

// Office software routes
router.get('/offices', isAuthenticated, referenceController.getAllOffices);
router.post('/offices', isAuthenticated, referenceController.createOffice);
router.post('/offices/:id', isAuthenticated, referenceController.updateOffice);
router.post('/offices/:id/delete', isAuthenticated, referenceController.deleteOffice);

// Sales/Receipt routes
router.get('/sales', isAuthenticated, referenceController.getAllSales);
router.post('/sales', isAuthenticated, referenceController.createSale);
router.post('/sales/:receipt', isAuthenticated, referenceController.updateSale);
router.post('/sales/:receipt/delete', isAuthenticated, referenceController.deleteSale);

module.exports = router;
