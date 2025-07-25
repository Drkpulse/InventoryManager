const express = require('express');
const router = express.Router();
const pdaController = require('../controllers/pdaController');
const { isAuthenticated } = require('../middleware/auth');

// PDA list and main routes
router.get('/', isAuthenticated, pdaController.getAllPDAs);
router.get('/new', isAuthenticated, pdaController.createPDAForm);
router.post('/', isAuthenticated, pdaController.createPDA);

// Individual PDA routes
router.get('/:id', isAuthenticated, pdaController.getPDAById);
router.get('/:id/edit', isAuthenticated, pdaController.updatePDAForm);
router.post('/:id', isAuthenticated, pdaController.updatePDA);
router.post('/:id/delete', isAuthenticated, pdaController.deletePDA);
router.get('/:id/history', isAuthenticated, pdaController.getPDAHistory);

module.exports = router;