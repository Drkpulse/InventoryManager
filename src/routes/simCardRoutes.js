const express = require('express');
const router = express.Router();
const simCardController = require('../controllers/simCardController');
const { isAuthenticated } = require('../middleware/auth');

// SIM card list and main routes
router.get('/', isAuthenticated, simCardController.getAllSIMCards);
router.get('/new', isAuthenticated, simCardController.createSIMCardForm);
router.post('/', isAuthenticated, simCardController.createSIMCard);

// Individual SIM card routes
router.get('/:id', isAuthenticated, simCardController.getSIMCardById);
router.get('/:id/edit', isAuthenticated, simCardController.updateSIMCardForm);
router.post('/:id', isAuthenticated, simCardController.updateSIMCard);
router.post('/:id/delete', isAuthenticated, simCardController.deleteSIMCard);
router.get('/:id/history', isAuthenticated, simCardController.getSIMCardHistory);

module.exports = router;