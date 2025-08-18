const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/referenceController');
const { hasPermission } = require('../middleware/permissions');

// Asset Types routes
router.get('/asset-types', hasPermission('references.view'), referenceController.assetTypes);
router.get('/asset-types/add', hasPermission('references.create'), referenceController.showAddAssetTypeForm);
router.post('/asset-types', hasPermission('references.create'), referenceController.addAssetType);
router.get('/asset-types/:id/edit', hasPermission('references.edit'), referenceController.showEditAssetTypeForm);
router.post('/asset-types/:id', hasPermission('references.edit'), referenceController.editAssetType);
router.post('/asset-types/:id/delete', hasPermission('references.delete'), referenceController.deleteAssetType);

// Status routes
router.get('/statuses', hasPermission('references.view'), referenceController.statuses);
router.get('/statuses/add', hasPermission('references.create'), referenceController.showAddStatusForm);
router.post('/statuses', hasPermission('references.create'), referenceController.addStatus);
router.get('/statuses/:id/edit', hasPermission('references.edit'), referenceController.showEditStatusForm);
router.post('/statuses/:id', hasPermission('references.edit'), referenceController.editStatus);
router.post('/statuses/:id/delete', hasPermission('references.delete'), referenceController.deleteStatus);

// Department routes
router.get('/departments', hasPermission('departments.view'), referenceController.departments);
router.get('/departments/new', hasPermission('departments.create'), referenceController.showAddDepartmentForm);
router.post('/departments', hasPermission('departments.create'), referenceController.addDepartment);
router.get('/departments/:id', hasPermission('departments.view'), referenceController.showDepartment);
router.get('/departments/:id/edit', hasPermission('departments.edit'), referenceController.showEditDepartmentForm);
router.post('/departments/:id', hasPermission('departments.edit'), referenceController.editDepartment);
router.post('/departments/:id/delete', hasPermission('departments.delete'), referenceController.deleteDepartment);

// Location routes
router.get('/locations', hasPermission('references.view'), referenceController.locations);
router.get('/locations/add', hasPermission('references.create'), referenceController.showAddLocationForm);
router.post('/locations', hasPermission('references.create'), referenceController.addLocation);
router.get('/locations/:id/edit', hasPermission('references.edit'), referenceController.showEditLocationForm);
router.post('/locations/:id', hasPermission('references.edit'), referenceController.editLocation);
router.post('/locations/:id/delete', hasPermission('references.delete'), referenceController.deleteLocation);

// Brands routes
router.get('/brands', hasPermission('references.view'), referenceController.brands);
router.get('/brands/add', hasPermission('references.create'), referenceController.showAddBrandForm);
router.post('/brands', hasPermission('references.create'), referenceController.addBrand);
router.get('/brands/:id/edit', hasPermission('references.edit'), referenceController.showEditBrandForm);
router.post('/brands/:id', hasPermission('references.edit'), referenceController.editBrand);
router.post('/brands/:id/delete', hasPermission('references.delete'), referenceController.deleteBrand);

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
