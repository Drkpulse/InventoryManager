const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/referenceController');
const { isAuthenticated } = require('../middleware/auth');

// Asset Types routes
router.get('/asset-types', isAuthenticated, referenceController.assetTypes);
router.get('/asset-types/add', isAuthenticated, referenceController.showAddAssetTypeForm);
router.post('/asset-types', isAuthenticated, referenceController.addAssetType);
router.get('/asset-types/:id/edit', isAuthenticated, referenceController.showEditAssetTypeForm);
router.post('/asset-types/:id', isAuthenticated, referenceController.editAssetType);
router.post('/asset-types/:id/delete', isAuthenticated, referenceController.deleteAssetType);

// Status routes
router.get('/statuses', isAuthenticated, referenceController.statuses);
router.get('/statuses/add', isAuthenticated, referenceController.showAddStatusForm);
router.post('/statuses', isAuthenticated, referenceController.addStatus);
router.get('/statuses/:id/edit', isAuthenticated, referenceController.showEditStatusForm);
router.post('/statuses/:id', isAuthenticated, referenceController.editStatus);
router.post('/statuses/:id/delete', isAuthenticated, referenceController.deleteStatus);

// Location routes
router.get('/locations', isAuthenticated, referenceController.locations);
router.get('/locations/add', isAuthenticated, referenceController.showAddLocationForm);
router.post('/locations', isAuthenticated, referenceController.addLocation);
router.get('/locations/:id/edit', isAuthenticated, referenceController.showEditLocationForm);
router.post('/locations/:id', isAuthenticated, referenceController.editLocation);
router.post('/locations/:id/delete', isAuthenticated, referenceController.deleteLocation);

// Brands routes
router.get('/brands', isAuthenticated, referenceController.brands);
router.get('/brands/add', isAuthenticated, referenceController.showAddBrandForm);
router.post('/brands', isAuthenticated, referenceController.addBrand);
router.get('/brands/:id/edit', isAuthenticated, referenceController.showEditBrandForm);
router.post('/brands/:id', isAuthenticated, referenceController.editBrand);
router.post('/brands/:id/delete', isAuthenticated, referenceController.deleteBrand);

// Software routes (renamed from offices)
router.get('/software', isAuthenticated, referenceController.software);
router.get('/software/add', isAuthenticated, referenceController.showAddSoftwareForm);
router.post('/software', isAuthenticated, referenceController.addSoftware);
router.get('/software/:id/edit', isAuthenticated, referenceController.showEditSoftwareForm);
router.post('/software/:id', isAuthenticated, referenceController.editSoftware);
router.post('/software/:id/delete', isAuthenticated, referenceController.deleteSoftware);
router.get('/software/:id/assignments', referenceController.getSoftwareAssignments);
router.post('/software/:id/assign', referenceController.assignSoftware);
router.post('/software/:id/unassign', referenceController.unassignSoftware);

// Backward compatibility: redirect old office routes to software
router.get('/offices', isAuthenticated, referenceController.offices);
router.get('/offices/add', isAuthenticated, referenceController.showAddOfficeForm);
router.post('/offices', isAuthenticated, referenceController.addOffice);
router.get('/offices/:id/edit', isAuthenticated, referenceController.showEditOfficeForm);
router.post('/offices/:id', isAuthenticated, referenceController.editOffice);
router.post('/offices/:id/delete', isAuthenticated, referenceController.deleteOffice);

// Index route - redirect to asset types as default
router.get('/', isAuthenticated, (req, res) => {
  res.redirect('/references/asset-types');
});

module.exports = router;
