const helmet = require('helmet');

/**
 * Enhanced Security Headers Configuration
 * Provides comprehensive security headers for production deployment
 */

const createSecurityHeaders = (isDevelopment = false) => {
  const baseConfig = {
    // Content Security Policy - Enhanced for security
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        // Script sources - be restrictive
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for some inline scripts - consider removing in future
          "'unsafe-eval'", // Required for some libraries - consider removing in future
          "https://cdnjs.cloudflare.com",
          "https://static.cloudflareinsights.com"
        ],

        // Script attribute sources - temporarily allow inline handlers while we clean up the codebase
        scriptSrcAttr: [
          "'unsafe-inline'" // Temporarily allow all inline handlers until we complete the migration
        ],

        // Style sources
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for dynamic styling
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],

        // Font sources
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
          "data:"
        ],

        // Image sources - allow data URIs and HTTPS
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "http:" // Consider removing in production if possible
        ],

        // Connect sources for AJAX requests
        connectSrc: [
          "'self'",
          "https://cloudflareinsights.com",
          "https://static.cloudflareinsights.com"
        ],

        // Frame sources - restrict iframes
        frameSrc: ["'self'"],

        // Object and embed sources - block plugins
        objectSrc: ["'none'"],

        // Media sources
        mediaSrc: ["'self'"],

        // Frame ancestors - prevent clickjacking
        frameAncestors: ["'self'"],

        // Base URI restriction
        baseUri: ["'self'"],

        // Form action restriction
        formAction: ["'self'"],

        // Worker sources
        workerSrc: ["'self'"],

        // Manifest sources
        manifestSrc: ["'self'"],

        // Note: pluginTypes directive is deprecated and removed

        // Block mixed content in production
        ...(isDevelopment ? {} : { upgradeInsecureRequests: [] })
      },

      // Report violations in development
      ...(isDevelopment ? {
        reportOnly: false,
        directives: {
          reportUri: '/csp-report'
        }
      } : {})
    },

    // Strict Transport Security - only in production with HTTPS
    hsts: !isDevelopment ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    } : false,

    // X-Frame-Options - prevent clickjacking
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options - prevent MIME sniffing
    noSniff: true,

    // X-XSS-Protection - enable XSS filtering
    xssFilter: true,

    // Referrer Policy - control referrer information
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },

    // Permissions Policy (formerly Feature Policy)
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: [],
      ambient_light_sensor: [],
      autoplay: ['self'],
      encrypted_media: ['self'],
      fullscreen: ['self'],
      picture_in_picture: ['self']
    },

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: {
      policy: 'same-origin'
    },

    // Origin-Agent-Cluster
    originAgentCluster: true,

    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },

    // Hide X-Powered-By header
    hidePoweredBy: true
  };

  return helmet(baseConfig);
};

// CSP violation reporting endpoint
const cspReportHandler = (req, res) => {
  console.warn('CSP Violation Report:', {
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    violation: req.body
  });

  // Log specific violation details for debugging
  if (req.body && req.body['csp-report']) {
    const report = req.body['csp-report'];
    console.warn('CSP Violation Details:', {
      blockedURI: report['blocked-uri'],
      documentURI: report['document-uri'],
      violatedDirective: report['violated-directive'],
      originalPolicy: report['original-policy']
    });
  }

  res.status(204).end();
};

// Additional security middleware
const additionalSecurityHeaders = (req, res, next) => {
  // Custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Cache control for sensitive pages
  if (req.path.includes('/admin') || req.path.includes('/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Prevent caching of CSRF tokens
  if (req.path.includes('/csrf')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
};

// MIME type security
const mimeTypeValidation = (req, res, next) => {
  // Validate file uploads if they exist
  if (req.files || (req.file && req.file.mimetype)) {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const files = req.files ? Object.values(req.files).flat() : [req.file];

    for (const file of files) {
      if (file && !allowedMimeTypes.includes(file.mimetype)) {
        console.warn('Rejected file upload - invalid MIME type:', {
          filename: file.originalname,
          mimetype: file.mimetype,
          ip: req.ip,
          userId: req.session?.user?.id
        });

        return res.status(400).json({
          success: false,
          error: 'File type not allowed. Please upload only images, PDFs, or spreadsheets.',
          code: 'INVALID_FILE_TYPE'
        });
      }
    }
  }

  next();
};

module.exports = {
  createSecurityHeaders,
  additionalSecurityHeaders,
  cspReportHandler,
  mimeTypeValidation
};
