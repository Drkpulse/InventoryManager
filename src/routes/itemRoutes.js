const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { hasPermission } = require('../middleware/permissions');

// Check for duplicate asset ID
router.get('/api/items/check-duplicate/:cep_brc', hasPermission('items.view'), async (req, res) => {
  try {
    const { cep_brc } = req.params;
    const db = require('../config/db');

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

// Change item status
router.post('/:id/:cep_brc/change-status', hasPermission('items.edit'), async (req, res) => {
  const { id, cep_brc } = req.params;
  const { status_id, reason } = req.body;
  const db = require('../config/db');
  const historyLogger = require('../utils/historyLogger');

  try {
    // Get current item status for history logging
    const currentItemResult = await db.query(
      'SELECT status_id, name FROM items WHERE id = $1 AND cep_brc = $2',
      [id, cep_brc]
    );

    if (currentItemResult.rows.length === 0) {
      req.flash('error', 'Item not found');
      return res.redirect('/items');
    }

    const currentItem = currentItemResult.rows[0];
    const currentStatusId = currentItem.status_id;

    // Only update if status actually changed
    if (parseInt(status_id) !== parseInt(currentStatusId)) {
      // Get status names for history logging
      const [oldStatusResult, newStatusResult] = await Promise.all([
        db.query('SELECT name FROM statuses WHERE id = $1', [currentStatusId]),
        db.query('SELECT name FROM statuses WHERE id = $1', [status_id])
      ]);

      const oldStatusName = oldStatusResult.rows[0]?.name || 'Unknown';
      const newStatusName = newStatusResult.rows[0]?.name || 'Unknown';

      // Update the item's status_id
      await db.query(
        'UPDATE items SET status_id = $1, updated_at = NOW() WHERE id = $2 AND cep_brc = $3',
        [status_id, id, cep_brc]
      );

      // Log status change to history
      await historyLogger.logItemHistory(
        id,
        'status_changed',
        {
          field: 'status',
          from: currentStatusId,
          to: parseInt(status_id),
          from_name: oldStatusName,
          to_name: newStatusName,
          reason: reason || 'Manual status change',
          item_name: currentItem.name,
          changed_by_user: req.session.user.name
        },
        req.session.user.id
      );

      console.log(`🔄 Status changed for item ${id} (${cep_brc}): ${oldStatusName} → ${newStatusName} by ${req.session.user.name}`);
      req.flash('success', `Status updated successfully from ${oldStatusName} to ${newStatusName}`);
    } else {
      req.flash('info', 'Status was not changed (same as current status)');
    }

  } catch (error) {
    console.error('❌ Error updating item status:', error);
    req.flash('error', 'Failed to update status: ' + error.message);
  }

  res.redirect(`/items/${id}/${cep_brc}`);
});

// Get all items
router.get('/', hasPermission('items.view'), itemController.getAllItems);

// Create new item
router.get('/new', hasPermission('items.create'), itemController.createItemForm);
router.post('/', hasPermission('items.create'), itemController.createItem);

// Bulk create assets
router.get('/bulk-create', hasPermission('items.create'), itemController.bulkCreateForm);
router.post('/bulk-create', hasPermission('items.create'), itemController.bulkCreateAssets);

// Get all unassigned items json
router.get('/api/unassigned', hasPermission('items.view'), itemController.getUnassignedItemsJson);

// Search items API
router.get('/api/search', hasPermission('items.view'), itemController.searchItems);

// New receipt and items
router.get('/new-receipt', hasPermission('items.create'), itemController.newReceiptForm);
router.post('/new-receipt', hasPermission('items.create'), itemController.createReceiptWithItems);

// Individual item routes with composite key
router.get('/:id/:cep_brc', hasPermission('items.view'), itemController.getItemById);
router.get('/:id/:cep_brc/edit', hasPermission('items.edit'), itemController.showEditItemForm);
router.post('/:id/:cep_brc', hasPermission('items.edit'), itemController.updateItem);
router.post('/:id/:cep_brc/delete', hasPermission('items.delete'), itemController.deleteItem);
router.get('/:id/:cep_brc/history', hasPermission('items.view'), itemController.getItemHistory);

// Assignment routes with composite key
router.get('/:id/:cep_brc/assign', hasPermission('items.assign'), itemController.assignItemForm);
router.post('/:id/:cep_brc/assign', hasPermission('items.assign'), itemController.assignItem);
router.post('/:id/:cep_brc/unassign', hasPermission('items.assign'), itemController.unassignItem);

module.exports = router;
