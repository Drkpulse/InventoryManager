const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { hasPermission } = require('../middleware/permissions');

// Client list and main routes
router.get('/', hasPermission('clients.view'), clientController.getAllClients);
router.get('/new', hasPermission('clients.create'), clientController.createClientForm);
router.post('/', hasPermission('clients.create'), clientController.createClient);

// Individual client routes
router.get('/:id', hasPermission('clients.view'), clientController.getClientById);
router.get('/:id/edit', hasPermission('clients.edit'), clientController.updateClientForm);
router.post('/:id', hasPermission('clients.edit'), clientController.updateClient);
router.post('/:id/delete', hasPermission('clients.delete'), clientController.deleteClient);
router.get('/:id/history', hasPermission('clients.view'), clientController.getClientHistory);

module.exports = router;
