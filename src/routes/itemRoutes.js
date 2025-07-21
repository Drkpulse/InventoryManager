const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Routes with composite key (id + cep_brc)
router.get('/', isAuthenticated, itemController.getAllItems);
router.get('/new', isAuthenticated, itemController.createItemForm);
router.post('/', isAuthenticated, itemController.createItem);

// New route for receipt and items
router.get('/new-receipt', isAuthenticated, itemController.newReceiptForm);
router.post('/new-receipt', isAuthenticated, itemController.createReceiptWithItems);

// Individual item routes with composite key
router.get('/:id/:cep_brc', isAuthenticated, itemController.getItemById);
router.get('/:id/:cep_brc/edit', isAuthenticated, itemController.updateItemForm);
router.post('/:id/:cep_brc', isAuthenticated, itemController.updateItem);
router.post('/:id/:cep_brc/delete', isAuthenticated, itemController.deleteItem);

// Assignment routes with composite key
router.get('/:id/:cep_brc/assign', isAuthenticated, itemController.assignItemForm);
router.post('/:id/:cep_brc/assign', isAuthenticated, itemController.assignItem);
router.post('/:id/:cep_brc/unassign', isAuthenticated, itemController.unassignItem);

module.exports = router;
