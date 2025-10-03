const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/referenceController');
const { hasPermission } = require('../middleware/permissions');

// Asset Types routes
router.get('/asset-types', hasPermission('references.view'), referenceController.assetTypes);
router.get('/asset-types/add', hasPermission('references.manage'), referenceController.showAddAssetTypeForm);
router.post('/asset-types', hasPermission('references.manage'), referenceController.addAssetType);
router.get('/asset-types/:id/edit', hasPermission('references.manage'), referenceController.showEditAssetTypeForm);
router.post('/asset-types/:id', hasPermission('references.manage'), referenceController.editAssetType);
router.post('/asset-types/:id/delete', hasPermission('references.manage'), referenceController.deleteAssetType);

// Status routes
router.get('/status', hasPermission('references.view'), referenceController.statuses);
router.get('/status/add', hasPermission('references.manage'), referenceController.showAddStatusForm);
router.post('/status', hasPermission('references.manage'), referenceController.addStatus);
router.get('/status/:id/edit', hasPermission('references.manage'), referenceController.showEditStatusForm);
router.post('/status/:id', hasPermission('references.manage'), referenceController.editStatus);
router.post('/status/:id/delete', hasPermission('references.manage'), referenceController.deleteStatus);

// Backward compatibility: redirect old statuses routes to status
router.get('/statuses', hasPermission('references.view'), (req, res) => {
  res.redirect('/references/status');
});
router.get('/statuses/add', hasPermission('references.manage'), (req, res) => {
  res.redirect('/references/status/add');
});
router.post('/statuses', hasPermission('references.manage'), (req, res) => {
  res.redirect('/references/status');
});
router.get('/statuses/:id/edit', hasPermission('references.manage'), (req, res) => {
  res.redirect(`/references/status/${req.params.id}/edit`);
});
router.post('/statuses/:id', hasPermission('references.manage'), (req, res) => {
  res.redirect('/references/status');
});
router.post('/statuses/:id/delete', hasPermission('references.manage'), (req, res) => {
  res.redirect('/references/status');
});

// Department routes
router.get('/departments', hasPermission('references.view'), referenceController.departments);
router.get('/departments/add', hasPermission('references.manage'), referenceController.showAddDepartmentForm);
router.post('/departments', hasPermission('references.manage'), referenceController.addDepartment);
router.get('/departments/:id/edit', hasPermission('references.manage'), referenceController.showEditDepartmentForm);
router.post('/departments/:id', hasPermission('references.manage'), referenceController.editDepartment);
router.post('/departments/:id/delete', hasPermission('references.manage'), referenceController.deleteDepartment);

// Location routes
router.get('/locations', hasPermission('references.view'), referenceController.locations);
router.get('/locations/add', hasPermission('references.manage'), referenceController.showAddLocationForm);
router.post('/locations', hasPermission('references.manage'), referenceController.addLocation);
router.get('/locations/:id/edit', hasPermission('references.manage'), referenceController.showEditLocationForm);
router.post('/locations/:id', hasPermission('references.manage'), referenceController.editLocation);
router.post('/locations/:id/delete', hasPermission('references.manage'), referenceController.deleteLocation);

// Brands routes
router.get('/brands', hasPermission('references.view'), referenceController.brands);
router.get('/brands/add', hasPermission('references.manage'), referenceController.showAddBrandForm);
router.post('/brands', hasPermission('references.manage'), referenceController.addBrand);
router.get('/brands/:id/edit', hasPermission('references.manage'), referenceController.showEditBrandForm);
router.post('/brands/:id', hasPermission('references.manage'), referenceController.editBrand);
router.post('/brands/:id/delete', hasPermission('references.manage'), referenceController.deleteBrand);

// Software routes (renamed from offices)
router.get('/software', hasPermission('software.view'), referenceController.software);
router.get('/software/add', hasPermission('software.create'), referenceController.showAddSoftwareForm);
router.post('/software', hasPermission('software.create'), referenceController.addSoftware);
router.get('/software/:id/edit', hasPermission('software.edit'), referenceController.showEditSoftwareForm);
router.post('/software/:id', hasPermission('software.edit'), referenceController.editSoftware);
router.post('/software/:id/delete', hasPermission('software.delete'), referenceController.deleteSoftware);
router.get('/software/:id/assignments', hasPermission('software.view'), referenceController.getSoftwareAssignments);
router.post('/software/:id/assign', hasPermission('software.assign'), referenceController.assignSoftware);
router.post('/software/:id/unassign', hasPermission('software.assign'), referenceController.unassignSoftware);

// Backward compatibility: redirect old office routes to software
router.get('/offices', hasPermission('software.view'), referenceController.offices);
router.get('/offices/add', hasPermission('software.create'), referenceController.showAddOfficeForm);
router.post('/offices', hasPermission('software.create'), referenceController.addOffice);
router.get('/offices/:id/edit', hasPermission('software.edit'), referenceController.showEditOfficeForm);
router.post('/offices/:id', hasPermission('software.edit'), referenceController.editOffice);
router.post('/offices/:id/delete', hasPermission('software.delete'), referenceController.deleteOffice);

// Index route - redirect to asset types as default
router.get('/', hasPermission('references.view'), (req, res) => {
  res.redirect('/references/asset-types');
});

module.exports = router;
