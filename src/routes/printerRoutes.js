const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');
const { hasPermission } = require('../middleware/permissions');

// Printer Management Permissions:
// printers.view, printers.create, printers.edit, printers.delete

// Printer list and main routes (asset-based, client assignment only)
router.get('/', hasPermission('printers.view'), printerController.index);
router.get('/new', hasPermission('printers.create'), printerController.new);
router.post('/', hasPermission('printers.create'), printerController.create);

// Individual printer routes
router.get('/:id', hasPermission('printers.view'), printerController.show);
router.get('/:id/edit', hasPermission('printers.edit'), printerController.edit);
router.put('/:id', hasPermission('printers.edit'), printerController.update);
router.delete('/:id', hasPermission('printers.delete'), printerController.delete);

// Client assignment routes
router.get('/:id/assign', hasPermission('printers.edit'), printerController.showAssign);
router.post('/:id/assign', hasPermission('printers.edit'), printerController.assign);
router.post('/:id/unassign', hasPermission('printers.edit'), printerController.unassign);

// History route
router.get('/:id/history', hasPermission('printers.view'), printerController.history);

module.exports = router;
