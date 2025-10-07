const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

// Enhanced search route - handles both AJAX and full page requests
router.get('/search', isAuthenticated, (req, res, next) => {
  // Check if it's an AJAX request or full page request
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    // AJAX request from dashboard dropdown
    req.query.format = 'json';
  } else if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Full page request (browser navigation)
    req.query.format = 'html';
  } else {
    // Default to HTML for direct browser requests
    req.query.format = 'html';
  }
  next();
}, dashboardController.searchAssets);

// Dashboard assets route
router.get('/assets', isAuthenticated, dashboardController.getAssets);

module.exports = router;
