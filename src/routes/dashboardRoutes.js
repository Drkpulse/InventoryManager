const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

// Dashboard search route - Fix: use searchAssets instead of search
router.get('/search', isAuthenticated, dashboardController.searchAssets);

// Dashboard assets route
router.get('/assets', isAuthenticated, dashboardController.getAssets);

module.exports = router;
