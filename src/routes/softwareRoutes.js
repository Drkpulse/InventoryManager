const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const softwareController = require('../controllers/softwareController');

// Main software routes
router.get('/', isAuthenticated, softwareController.index);
router.get('/add', isAuthenticated, softwareController.showAddForm);
router.post('/', isAuthenticated, softwareController.create);
router.get('/:id/edit', isAuthenticated, softwareController.showEditForm);
router.post('/:id', isAuthenticated, softwareController.update);
router.post('/:id/delete', isAuthenticated, softwareController.delete);

// Assignment routes
router.get('/:id/assignments', softwareController.getAssignments);
router.post('/:id/assign', softwareController.assign);
router.post('/:id/unassign', softwareController.unassign);

// Export route
router.get('/export', isAuthenticated, softwareController.export);

module.exports = router;
