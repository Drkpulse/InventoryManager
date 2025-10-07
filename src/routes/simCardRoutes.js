const express = require('express');
const router = express.Router();
const simCardController = require('../controllers/simCardController');
const { hasPermission } = require('../middleware/permissions');

// SIM card Management Permissions:
// sim_cards.view, sim_cards.create, sim_cards.edit, sim_cards.delete

// SIM card list and main routes
router.get('/', hasPermission('sim_cards.view'), simCardController.getAllSIMCards);
router.get('/new', hasPermission('sim_cards.create'), simCardController.createSIMCardForm);
router.post('/', hasPermission('sim_cards.create'), simCardController.createSIMCard);

// Individual SIM card routes
router.get('/:id', hasPermission('sim_cards.view'), simCardController.getSIMCardById);
router.get('/:id/edit', hasPermission('sim_cards.edit'), simCardController.updateSIMCardForm);
router.post('/:id', hasPermission('sim_cards.edit'), simCardController.updateSIMCard);
router.post('/:id/delete', hasPermission('sim_cards.delete'), simCardController.deleteSIMCard);
router.get('/:id/history', hasPermission('sim_cards.view'), simCardController.getSIMCardHistory);

module.exports = router;
