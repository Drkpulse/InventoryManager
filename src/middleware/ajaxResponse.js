const ejs = require('ejs');
const path = require('path');

/**
 * Middleware to handle AJAX requests and return JSON responses
 * for the content loader system
 */
function handleAjaxResponse(req, res, next) {
  const originalRender = res.render;

  res.render = function(view, options = {}, callback) {
    // Check if this is an AJAX request
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    console.log('🔍 AJAX Response Middleware:', {
      url: req.url,
      isAjax,
      view,
      body: options.body
    });

    if (isAjax) {
      // For AJAX requests, render the content and return JSON
      const viewPath = path.join(__dirname, '../views', view + '.ejs');
      
      // If it's the layout view, extract the body content
      if (view === 'layout' && options.body) {
        const bodyViewPath = path.join(__dirname, '../views', options.body + '.ejs');
        
        ejs.renderFile(bodyViewPath, options, (err, bodyHtml) => {
          if (err) {
            console.error('Error rendering body view:', err);
            return res.status(500).json({ error: 'Failed to render content' });
          }

          res.json({
            title: options.title || 'Inventory Management',
            content: bodyHtml,
            success: true
          });
        });
      } else {
        // Regular view rendering for AJAX
        ejs.renderFile(viewPath, options, (err, html) => {
          if (err) {
            console.error('Error rendering view:', err);
            return res.status(500).json({ error: 'Failed to render content' });
          }

          res.json({
            title: options.title || 'Inventory Management',
            content: html,
            success: true
          });
        });
      }
    } else {
      // For regular requests, use the original render method
      originalRender.call(this, view, options, callback);
    }
  };

  next();
}

module.exports = handleAjaxResponse;