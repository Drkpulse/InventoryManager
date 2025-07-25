const express = require('express');
const router = express.Router();

// Test route to verify AJAX navigation
router.get('/ajax-test', (req, res) => {
  console.log('🧪 Test route accessed via:', req.headers['x-requested-with'] ? 'AJAX' : 'Direct');
  
  res.render('layout', {
    title: 'AJAX Test Page',
    body: 'test/ajax-test',
    user: req.session.user
  });
});

module.exports = router;