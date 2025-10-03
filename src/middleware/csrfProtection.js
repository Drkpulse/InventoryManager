const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens to prevent Cross-Site Request Forgery attacks
 */

// Generate CSRF token
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// CSRF token generation middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for safe methods and API health checks
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const skipPaths = ['/health', '/api/health'];

  if (safeMethods.includes(req.method) || skipPaths.includes(req.path)) {
    // Generate token for safe methods (to include in forms)
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCSRFToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
    return next();
  }

  // For unsafe methods, validate CSRF token
  const sessionToken = req.session.csrfToken;
  const requestToken = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;

  if (!sessionToken) {
    console.warn('CSRF: No session token found', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing from session. Please refresh the page.',
      code: 'CSRF_SESSION_MISSING'
    });
  }

  if (!requestToken) {
    console.warn('CSRF: No request token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      userId: req.session?.user?.id
    });
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing from request. Please refresh the page and try again.',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  // Handle potential token duplication (e.g., "token, token")
  const cleanRequestToken = requestToken.includes(',') ? requestToken.split(',')[0].trim() : requestToken;

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(cleanRequestToken))) {
    console.warn('CSRF: Token mismatch detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      userId: req.session?.user?.id,
      sessionTokenLength: sessionToken.length,
      requestTokenLength: requestToken.length,
      cleanRequestTokenLength: cleanRequestToken.length,
      originalRequestToken: requestToken,
      cleanRequestToken: cleanRequestToken
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token. Please refresh the page and try again.',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  // Token is valid - keep the same token for the session (don't regenerate)
  res.locals.csrfToken = req.session.csrfToken;

  next();
};

// Middleware to add CSRF token to all responses
const addCSRFToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = {
  csrfProtection,
  addCSRFToken,
  generateCSRFToken
};
