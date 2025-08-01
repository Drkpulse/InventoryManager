const express = require('express');
const router = express.Router();
const pdaController = require('../controllers/pdaController');
const { hasPermission } = require('../middleware/permissions');

// PDA Management Permissions:
// pdas.view, pdas.create, pdas.edit, pdas.delete

// PDA list and main routes
router.get('/', hasPermission('pdas.view'), pdaController.getAllPDAs);
router.get('/new', hasPermission('pdas.create'), pdaController.createPDAForm);
router.post('/', hasPermission('pdas.create'), pdaController.createPDA);

// Individual PDA routes
router.get('/:id', hasPermission('pdas.view'), pdaController.getPDAById);
router.get('/:id/edit', hasPermission('pdas.edit'), pdaController.updatePDAForm);
router.post('/:id', hasPermission('pdas.edit'), pdaController.updatePDA);
router.post('/:id/delete', hasPermission('pdas.delete'), pdaController.deletePDA);
router.get('/:id/history', hasPermission('pdas.view'), pdaController.getPDAHistory);

module.exports = router;
