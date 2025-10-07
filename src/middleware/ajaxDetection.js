/**
 * Middleware to detect AJAX requests
 */
function detectAjaxRequest(req, res, next) {
  // Check for AJAX request indicators
  req.isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
              req.get('Accept')?.includes('application/json') ||
              req.headers['content-type']?.includes('application/json');

  // Log for debugging
  if (req.url.includes('/auth/login') && req.method === 'POST') {
    console.log('Login request detection:', {
      isAjax: req.isAjax,
      xRequestedWith: req.headers['x-requested-with'],
      accept: req.get('Accept'),
      contentType: req.headers['content-type']
    });
  }

  next();
}

module.exports = detectAjaxRequest;
