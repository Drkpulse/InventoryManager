const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { hasPermission } = require('../middleware/permissions');

// Client list and main routes
router.get('/', hasPermission('clients.view'), clientController.index);
router.get('/new', hasPermission('clients.create'), clientController.new);
router.post('/', hasPermission('clients.create'), clientController.create);

// Individual client routes
router.get('/:id', hasPermission('clients.view'), clientController.show);
router.get('/:id/edit', hasPermission('clients.edit'), clientController.edit);
router.post('/:id', hasPermission('clients.edit'), clientController.update);
router.post('/:id/assign-printer', hasPermission('clients.edit'), clientController.assignPrinter);
router.delete('/:id', hasPermission('clients.delete'), clientController.delete);

module.exports = router;
