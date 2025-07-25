const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Add this route before your existing routes
router.get('/api/items/check-duplicate/:cep_brc', isAuthenticated, async (req, res) => {
  try {
    const { cep_brc } = req.params;

    const result = await db.query(`
      SELECT i.id, i.cep_brc, i.name, i.assigned_to,
             t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE LOWER(i.cep_brc) = LOWER($1)
    `, [cep_brc]);

    if (result.rows.length > 0) {
      res.json({
        exists: true,
        asset: result.rows[0]
      });
    } else {
      res.json({
        exists: false
      });
    }
  } catch (error) {
    console.error('Error checking duplicate asset ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Routes with composite key (id + cep_brc)
router.get('/', isAuthenticated, itemController.getAllItems);

// Check that these routes exist
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
router.get('/:id/:cep_brc/history', isAuthenticated, itemController.getItemHistory);

// Check that this route exists:
router.get('/:id/:cep_brc/history', isAuthenticated, itemController.getItemHistory);

// Assignment routes with composite key
router.get('/:id/:cep_brc/assign', isAuthenticated, itemController.assignItemForm);
router.post('/:id/:cep_brc/assign', isAuthenticated, itemController.assignItem);
router.post('/:id/:cep_brc/unassign', isAuthenticated, itemController.unassignItem);

// Status change route
router.post('/:id/:cep_brc/status', isAuthenticated, itemController.changeItemStatus);

module.exports = router;
