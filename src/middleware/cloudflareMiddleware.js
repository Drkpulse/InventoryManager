/**
 * Cloudflare Compatibility Middleware
 * Handles Cloudflare-specific issues and configurations
 */

const cloudflareMiddleware = (req, res, next) => {
  // Set headers to prevent Cloudflare from injecting scripts automatically
  res.setHeader('CF-Auto-Minify', 'off');

  // Disable Cloudflare's automatic optimization features that might inject scripts
  res.setHeader('CF-Rocket-Loader', 'off');

  // Set proper cache headers for Cloudflare
  if (req.path.includes('/css/') || req.path.includes('/js/') || req.path.includes('/images/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
};

// Enhanced CSP for Cloudflare compatibility
const getCloudflareCompatibleCSP = (isDevelopment = false) => {
  return {
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Still needed for some inline scripts
        "https://cdnjs.cloudflare.com",
        // Remove Cloudflare Insights to prevent issues
        ...(isDevelopment ? ["'unsafe-eval'"] : [])
      ],

      scriptSrcAttr: [
        "'unsafe-hashes'",
        "'sha256-Cev7VdOaJbNpS7dtpxT4qcPWi1Ny1d1sLr5dBTRjJEc='", // CSS fallback onerror
        "'sha256-ydhaqQZpadLMtf+gcgsLrvkI8VrZQA6ET7n6iuy4DaQ='", // refreshInsights
        "'sha256-HQDusoZp2P6uHKhFJLUbfSsCwL2VXKm9Gc7pb8hY83c='", // acceptAllCookies
        "'sha256-1D661lQWH+HQSCZlF7HjP8HJ4OAkfMw7Pj6YKVKE5yg='", // showCookieManager
        "'sha256-rD7gnU2Hnfuy7oRTCOZX6rkWA4n+XBumOVnUAxblJZM='", // rejectCookies
        "'sha256-rLbRhIp2kRJJUrnze08NFTpJqcoSkBvtPjbD7fXYNRo='", // hideCookieManager
        "'sha256-Cv/hUd7yhDU3IwRGCzMQWWw7aeqoJMJb+Ysb/fzr8hs='", // updateCookiePreferences
        "'sha256-mXrn+zTYhpPQrX6F6XDf6UOD//OH2KoMZQLNSrDpInU='", // clearAllCookies
        "'sha256-lIGaqtbGGIk1DOCpFz7KpFXGpOJ/9/wuvf/k9++N1Wg='" // exportCookieData
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],

      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com",
        "data:"
      ],

      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "http:"
      ],

      connectSrc: [
        "'self'"
        // Removed Cloudflare Insights endpoints to prevent CORS issues
      ],

      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],

      ...(isDevelopment ? {} : { upgradeInsecureRequests: [] })
    },

    reportOnly: isDevelopment,
    ...(isDevelopment ? {
      reportUri: '/csp-report'
    } : {})
  };
};

// Disable Cloudflare's automatic optimizations
const disableCloudflareOptimizations = (req, res, next) => {
  // Add meta tags to prevent Cloudflare auto-minification
  res.locals.cloudflareMetaTags = `
    <meta name="cf-auto-minify" content="false">
    <meta name="cf-rocket-loader" content="false">
  `;

  next();
};

module.exports = {
  cloudflareMiddleware,
  getCloudflareCompatibleCSP,
  disableCloudflareOptimizations
};
