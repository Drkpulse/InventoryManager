const express = require('express');
const router = express.Router();
const softwareController = require('../controllers/softwareController');
const { hasPermission } = require('../middleware/permissions');

// Main software routes
router.get('/', hasPermission('software.view'), softwareController.index);
router.get('/add', hasPermission('software.create'), softwareController.showAddForm);
router.post('/', hasPermission('software.create'), softwareController.create);
router.get('/:id/edit', hasPermission('software.edit'), softwareController.showEditForm);
router.post('/:id', hasPermission('software.edit'), softwareController.update);
router.post('/:id/delete', hasPermission('software.delete'), softwareController.delete);


// Assignment routes
router.get('/api/available', hasPermission('software.assign'), softwareController.getAvailableSoftware);
router.get('/:id/assignments', hasPermission('software.view'), softwareController.getAssignments);
router.post('/:id/assign', hasPermission('software.assign'), softwareController.assign);
router.post('/:id/unassign', hasPermission('software.assign'), softwareController.unassign);

// Export route
router.get('/export', hasPermission('reports.export'), softwareController.export);

module.exports = router;
