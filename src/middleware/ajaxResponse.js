const ejs = require('ejs');
const path = require('path');

/**
 * Enhanced AJAX content middleware - returns only the main content with proper context
 */
function handleAjaxResponse(req, res, next) {
  const originalRender = res.render;

  res.render = function(view, options = {}, callback) {
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (isAjax && view === 'layout' && options.body) {
      // For AJAX requests, render only the body content, not the full layout
      const bodyViewPath = path.join(__dirname, '../views', options.body + '.ejs');

      // Ensure all necessary context is available for AJAX rendering
      const renderContext = {
        ...options,
        // Include all res.locals which contains translation function and other context
        ...res.locals,
        // Override with any specific options passed
        ...options,
        // Ensure request and response are available
        req: req,
        res: res
      };

      ejs.renderFile(bodyViewPath, renderContext, (err, bodyHtml) => {
        if (err) {
          console.error('AJAX render error:', err);
          return res.status(500).json({ error: 'Render failed', details: err.message });
        }

        res.json({
          title: options.title,
          content: bodyHtml
        });
      });
    } else {
      // Normal page request - use original render
      originalRender.call(this, view, options, callback);
    }
  };

  next();
}

module.exports = handleAjaxResponse;
