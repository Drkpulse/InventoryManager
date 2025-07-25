const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');
const { isAuthenticated } = require('../middleware/auth');

// Printer list and main routes
router.get('/', isAuthenticated, printerController.getAllPrinters);
router.get('/new', isAuthenticated, printerController.createPrinterForm);
router.post('/', isAuthenticated, printerController.createPrinter);

// Individual printer routes
router.get('/:id', isAuthenticated, printerController.getPrinterById);
router.get('/:id/edit', isAuthenticated, printerController.updatePrinterForm);
router.post('/:id', isAuthenticated, printerController.updatePrinter);
router.post('/:id/delete', isAuthenticated, printerController.deletePrinter);
router.get('/:id/history', isAuthenticated, printerController.getPrinterHistory);

module.exports = router;