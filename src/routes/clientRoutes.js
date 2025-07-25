const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { isAuthenticated } = require('../middleware/auth');

// Client list and main routes
router.get('/', isAuthenticated, clientController.getAllClients);
router.get('/new', isAuthenticated, clientController.createClientForm);
router.post('/', isAuthenticated, clientController.createClient);

// Individual client routes
router.get('/:id', isAuthenticated, clientController.getClientById);
router.get('/:id/edit', isAuthenticated, clientController.updateClientForm);
router.post('/:id', isAuthenticated, clientController.updateClient);
router.post('/:id/delete', isAuthenticated, clientController.deleteClient);
router.get('/:id/history', isAuthenticated, clientController.getClientHistory);

module.exports = router;