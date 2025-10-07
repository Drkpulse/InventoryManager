const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');
const { hasPermission } = require('../middleware/permissions');

// Printer Management Permissions:
// printers.view, printers.create, printers.edit, printers.delete

// Printer list and main routes
router.get('/', hasPermission('printers.view'), printerController.getAllPrinters);
router.get('/new', hasPermission('printers.create'), printerController.createPrinterForm);
router.post('/', hasPermission('printers.create'), printerController.createPrinter);

// Individual printer routes
router.get('/:id', hasPermission('printers.view'), printerController.getPrinterById);
router.get('/:id/edit', hasPermission('printers.edit'), printerController.updatePrinterForm);
router.post('/:id', hasPermission('printers.edit'), printerController.updatePrinter);
router.post('/:id/delete', hasPermission('printers.delete'), printerController.deletePrinter);
router.get('/:id/history', hasPermission('printers.view'), printerController.getPrinterHistory);

module.exports = router;
