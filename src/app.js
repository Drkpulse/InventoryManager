// Add immediate console output for container visibility
console.log('🚀 IT Asset Manager - Starting application...');
console.log('📅 Timestamp:', new Date().toISOString());
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const morgan = require('morgan');
const winston = require('winston');
require('winston-daily-rotate-file');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const session = require('express-session');
const redis = require('redis');
const fs = require('fs');

// Import RedisStore for connect-redis v9+
const { RedisStore } = require('connect-redis');

// Import application modules
const routes = require('./routes');
const clientRoutes = require('./routes/clientRoutes');
const printerRoutes = require('./routes/printerRoutes');
const pdaRoutes = require('./routes/pdaRoutes');
const simCardRoutes = require('./routes/simCardRoutes');
const { isAuthenticated } = require('./middleware/auth');
const { translationMiddleware, languageSwitcher } = require('./middleware/translationMiddleware');
const { loadUserPermissions, addPermissionHelpers } = require('./middleware/permissions');
const { requireValidLicense } = require('./middleware/licenseValidator');
const detectAjaxRequest = require('./middleware/ajaxDetection');
const handleAjaxResponse = require('./middleware/ajaxResponse');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger for production
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
	winston.format.timestamp(),
	winston.format.errors({ stack: true }),
	winston.format.json()
  ),
  defaultMeta: { service: 'it-asset-manager' },
  transports: [
	new winston.transports.DailyRotateFile({
	  filename: 'logs/error-%DATE%.log',
	  datePattern: 'YYYY-MM-DD',
	  level: 'error',
	  maxSize: '20m',
	  maxFiles: '14d'
	}),
	new winston.transports.DailyRotateFile({
	  filename: 'logs/combined-%DATE%.log',
	  datePattern: 'YYYY-MM-DD',
	  maxSize: '20m',
	  maxFiles: '7d'
	})
  ]
});

// Add console logging for non-production or when running in containers
// Check for containerized environment (Docker/Kubernetes/etc)
const isContainer = process.env.DOCKER_CONTAINER === 'true' ||
                   process.env.container ||
                   require('fs').existsSync('/.dockerenv');

if (process.env.NODE_ENV !== 'production' || isContainer) {
  logger.add(new winston.transports.Console({
	format: winston.format.combine(
	  winston.format.colorize(),
	  winston.format.simple()
	)
  }));
}

// Redis setup with improved error handling
let redisClient;
let redisConnected = false;
let sessionStore;

// Make redisConnected globally accessible for debugging
global.redisConnected = false;

const initializeRedis = async () => {
  try {
    // Skip Redis if no configuration provided
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      logger.info('🔧 No Redis configuration found, skipping Redis setup');
      logger.info('⚠️ Using file-based sessions instead');
      redisConnected = false;
      sessionStore = createFileSessionStore();
      return;
    }

    logger.info('🔧 Initializing Redis connection...');

    // Construct Redis URL from REDIS_HOST and REDIS_PORT or use REDIS_URL directly
    let redisUrl;

    if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
      redisUrl = process.env.REDIS_URL.trim();
      logger.info(`📡 Using provided Redis URL: ${redisUrl.replace(/\/\/.*@/, '//***@')}`);

      // Validate URL format
      try {
        new URL(redisUrl);
      } catch (error) {
        logger.error(`❌ Invalid REDIS_URL format: ${redisUrl}`);
        logger.info('💡 REDIS_URL should be like: redis://hostname:6379 or redis://user:pass@hostname:6379');
        throw new Error(`Invalid REDIS_URL format: ${error.message}`);
      }

    } else if (process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '') {
      const redisHost = process.env.REDIS_HOST.trim();
      const redisPort = (process.env.REDIS_PORT || '6379').trim();

      // Validate host format (no protocol, no port)
      if (redisHost.includes('://') || redisHost.includes(':')) {
        logger.error(`❌ Invalid REDIS_HOST format: ${redisHost}`);
        logger.info('💡 REDIS_HOST should be just the hostname/IP (e.g., 192.168.1.100, not redis://192.168.1.100:6379)');
        logger.info('💡 Use REDIS_URL for full URLs, or separate REDIS_HOST and REDIS_PORT');
        throw new Error(`Invalid REDIS_HOST format. Use hostname/IP only, not full URL.`);
      }

      redisUrl = `redis://${redisHost}:${redisPort}`;
      logger.info(`📡 Constructed Redis URL from host/port: redis://${redisHost}:${redisPort}`);

    } else {
      redisUrl = 'redis://127.0.0.1:6379';
      logger.info('📡 Using default Redis URL: redis://127.0.0.1:6379');
    }

    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        family: 4,
        reconnectStrategy: (retries) => {
          logger.warn(`Redis reconnection attempt: ${retries}`);
          if (retries > 10) {
            logger.error('❌ Redis max retry attempts reached');
            return false;
          }
          return Math.min(retries * 200, 5000);
        }
      },
      retry_unfulfilled_commands: true,
      lazyConnect: true
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Client Connected');
      redisConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis Client Reconnecting...');
    });

    try {
      await redisClient.connect();
      logger.info('✅ Connected to Redis');
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'inv_mgr:',
        ttl: 24 * 60 * 60,
        disableTouch: true
      });
      redisConnected = true;
      global.redisConnected = true;
      logger.info('✅ Redis session store configured successfully');
    } catch (err) {
      logger.error('❌ Redis connection failed, falling back to memory store:', err);
      redisConnected = false;
      global.redisConnected = false;
      sessionStore = createFileSessionStore();
      // Don't exit - let the app continue with file-based store
    }

  } catch (error) {
    logger.error('❌ Redis initialization failed:', error);

    // Provide specific troubleshooting guidance
    if (error.message.includes('Invalid URL') || error.code === 'ERR_INVALID_URL') {
      logger.error('🔧 REDIS CONFIGURATION ERROR:');
      logger.error('   Check your Redis configuration in Unraid container settings:');
      logger.error('   ❌ Wrong: REDIS_HOST = "192.168.1.200:6379" (includes port)');
      logger.error('   ❌ Wrong: REDIS_URL = "192.168.1.200:6379" (missing protocol)');
      logger.error('   ✅ Correct: REDIS_HOST = "192.168.1.200" + REDIS_PORT = "6379"');
      logger.error('   ✅ Correct: REDIS_URL = "redis://192.168.1.200:6379"');
      logger.error('   💡 Or leave Redis fields EMPTY to use file-based sessions');
    }

    logger.info('⚠️ Falling back to file-based sessions');
    redisConnected = false;
    sessionStore = createFileSessionStore();
  }
};

// Create file-based session store for container persistence
const createFileSessionStore = () => {
  try {
    // Use /config volume for persistent session storage
    const sessionDir = process.env.SESSION_DIR || '/config/sessions';

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      logger.info(`📁 Created session directory: ${sessionDir}`);
    }

    // Simple file-based session store implementation
    const FileStore = session.MemoryStore;
    const fileStore = new FileStore();

    // Override get/set/destroy methods for file persistence
    const sessionFile = path.join(sessionDir, 'sessions.json');

    // Load existing sessions on startup
    if (fs.existsSync(sessionFile)) {
      try {
        const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        fileStore.sessions = sessionData;
        logger.info('✅ Loaded existing sessions from file');
      } catch (error) {
        logger.warn('⚠️ Failed to load session file, starting fresh');
      }
    }

    // Override set method to persist to file
    const originalSet = fileStore.set.bind(fileStore);
    fileStore.set = function(sid, session, callback) {
      originalSet(sid, session, (err) => {
        if (err) return callback(err);

        // Persist to file
        try {
          fs.writeFileSync(sessionFile, JSON.stringify(this.sessions, null, 2));
        } catch (error) {
          logger.warn('⚠️ Failed to persist session to file:', error);
        }
        callback();
      });
    };

    // Override destroy method
    const originalDestroy = fileStore.destroy.bind(fileStore);
    fileStore.destroy = function(sid, callback) {
      originalDestroy(sid, (err) => {
        if (err) return callback(err);

        // Update file
        try {
          fs.writeFileSync(sessionFile, JSON.stringify(this.sessions, null, 2));
        } catch (error) {
          logger.warn('⚠️ Failed to update session file:', error);
        }
        callback();
      });
    };

    logger.info(`✅ File-based session store configured: ${sessionDir}`);
    return fileStore;

  } catch (error) {
    logger.error('❌ Failed to create file session store:', error);
    logger.info('⚠️ Falling back to memory store');
    return undefined;
  }
};

// Daily status reporting function
const setupDailyStatusReport = () => {
  const cron = require('node-cron');

  // Run daily at 6:00 AM
  cron.schedule('0 6 * * *', () => {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    logger.info('📊 Daily System Status Report', {
      timestamp: new Date().toISOString(),
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      environment: process.env.NODE_ENV,
      services: {
        redis: redisConnected ? '✅ Connected' : '❌ Disconnected',
        database: 'Checking...'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      },
      pid: process.pid
    });

    // Test database connection
    const testDatabaseConnection = async () => {
      try {
        const db = require('./config/db');
        await db.query('SELECT 1');
        logger.info('💾 Database Status: ✅ Connected');
      } catch (error) {
        logger.error('💾 Database Status: ❌ Connection failed', error.message);
      }
    };

    testDatabaseConnection();
  });

  logger.info('⏰ Daily status reporting scheduled for 6:00 AM');
};

// Start application initialization
const startApplication = async () => {
  try {
	await initializeRedis();

	// Trust proxy for production deployments
	if (process.env.NODE_ENV === 'production') {
	  app.set('trust proxy', 1);
	}

	// Enhanced security middleware
	const { createSecurityHeaders, additionalSecurityHeaders, cspReportHandler, mimeTypeValidation } = require('./middleware/securityHeaders');
	const { cloudflareMiddleware, disableCloudflareOptimizations } = require('./middleware/cloudflareMiddleware');
	const { csrfProtection, addCSRFToken } = require('./middleware/csrfProtection');
	const { xssProtection, handleValidationErrors } = require('./middleware/inputValidation');
	const { loginRateLimit, apiRateLimit, accountLockout } = require('./middleware/rateLimiting');

	// Apply Cloudflare compatibility middleware first
	app.use(cloudflareMiddleware);
	app.use(disableCloudflareOptimizations);

	// Apply security headers
	const isDevelopment = process.env.NODE_ENV !== 'production';
	app.use(createSecurityHeaders(isDevelopment));
	app.use(additionalSecurityHeaders);

	// CSP violation reporting
	app.post('/csp-report', express.json(), cspReportHandler);

	// CORS configuration
	app.use(cors({
	  origin: process.env.CORS_ORIGIN || false,
	  credentials: true,
	  optionsSuccessStatus: 200
	}));

	// Compression middleware
	app.use(compression({
	  level: 6,
	  threshold: 1024,
	  filter: (req, res) => {
		if (req.headers['x-no-compression']) {
		  return false;
		}
		return compression.filter(req, res);
	  }
	}));

	// Enhanced rate limiting
	const generalLimiter = rateLimit({
	  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
	  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
	  message: {
		error: 'Too many requests from this IP, please try again later.'
	  },
	  standardHeaders: true,
	  legacyHeaders: false,
	  skip: (req) => {
		// Skip rate limiting for health checks
		return req.path === '/health';
	  }
	});
	app.use(generalLimiter);

	// HTTP Parameter Pollution protection
	app.use(hpp());

	// Logging middleware
	app.use(morgan('combined', {
	  stream: {
		write: (message) => logger.info(message.trim())
	  }
	}));

	// View engine setup
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'ejs');

	// Static files with caching and proper headers
	app.use(express.static(path.join(__dirname, '../public'), {
	  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
	  etag: true,
	  lastModified: true,
	  setHeaders: (res, filePath) => {
		// Set proper MIME types for CSS and JS files
		if (filePath.endsWith('.css')) {
		  res.setHeader('Content-Type', 'text/css; charset=utf-8');
		} else if (filePath.endsWith('.js')) {
		  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
		}
		// Add cache control for static assets
		if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
		  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
		}
	  }
	}));

	// Log static file requests for debugging
	app.use('/css/*', (req, res, next) => {
	  logger.info(`🎨 CSS request: ${req.url}`);
	  next();
	});

	// Debug route to check CSS file existence
	app.get('/debug/css', (req, res) => {
	  const cssDir = path.join(__dirname, '../public/css');
	  const fs = require('fs');

	  try {
		const files = fs.readdirSync(cssDir);
		const cssFiles = {};

		files.forEach(file => {
		  const filePath = path.join(cssDir, file);
		  const stats = fs.statSync(filePath);
		  cssFiles[file] = {
			size: stats.size,
			modified: stats.mtime,
			exists: true
		  };
		});

		res.json({
		  status: 'success',
		  cssDirectory: cssDir,
		  files: cssFiles,
		  totalFiles: files.length
		});
	  } catch (error) {
		res.status(500).json({
		  status: 'error',
		  message: error.message,
		  cssDirectory: cssDir
		});
	  }
	});

	// Debug route to check CSP configuration
	app.get('/debug/csp', (req, res) => {
	  const cspHeader = res.getHeaders()['content-security-policy'] || 'Not set';
	  const cspConfig = {
		scriptSrc: [
		  "'self'",
		  "'unsafe-inline'",
		  "'unsafe-eval'",
		  "https://cdnjs.cloudflare.com",
		  "https://static.cloudflareinsights.com"
		],
		styleSrc: [
		  "'self'",
		  "'unsafe-inline'",
		  "https://cdnjs.cloudflare.com"
		],
		fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
		connectSrc: ["'self'", "https://cloudflareinsights.com"],
		imgSrc: ["'self'", "data:", "https:", "http:"]
	  };

	  res.json({
		status: 'success',
		cspHeaderValue: cspHeader,
		configuredDirectives: cspConfig,
		troubleshooting: {
		  cloudflareInsights: 'https://static.cloudflareinsights.com should be allowed',
		  fontAwesome: 'https://cdnjs.cloudflare.com should be allowed',
		  instructions: 'Check browser console for specific CSP violations'
		}
	  });
	});

	// Debug route to test settings synchronization
	app.get('/debug/settings', (req, res) => {
	  const user = req.session?.user;
	  const cookies = req.headers.cookie || '';
	  const userThemeCookie = cookies.split(';').find(c => c.trim().startsWith('user_theme='));

	  res.json({
		status: 'success',
		timestamp: new Date().toISOString(),
		session: {
		  isAuthenticated: !!user,
		  userId: user?.id,
		  userName: user?.name,
		  userSettings: user?.settings || null
		},
		cookies: {
		  userTheme: userThemeCookie ? userThemeCookie.split('=')[1] : null,
		  allCookies: cookies
		},
		synchronization: {
		  databaseSettings: user?.settings ? 'loaded from database' : 'not available',
		  sessionSettings: user?.settings ? 'available in session' : 'not in session',
		  cookieTheme: userThemeCookie ? 'theme cookie set' : 'no theme cookie',
		  frontendReady: user?.settings ? 'ready for frontend' : 'needs authentication'
		},
		endpoints: {
		  settingsPage: '/users/settings',
		  updateDisplay: 'POST /users/settings/display',

		  updateSecurity: 'POST /users/settings/security'
		}
	  });
	});

	// AJAX detection middleware
	app.use(detectAjaxRequest);
	app.use(handleAjaxResponse);

	// Body parsing middleware with limits
	// Enhanced input parsing with security
	app.use(express.urlencoded({
	  extended: true,
	  limit: '2mb', // Reduced from 10mb for security
	  parameterLimit: 100 // Reduced from 1000
	}));
	app.use(express.json({
	  limit: '2mb', // Reduced from 10mb for security
	  strict: true
	}));

	// Apply XSS protection
	app.use(xssProtection);

	// File upload MIME type validation
	app.use(mimeTypeValidation);

	app.use(methodOverride('_method'));

	// Session configuration with enhanced security
	const sessionSecret = process.env.SESSION_SECRET;
	if (!sessionSecret || sessionSecret.length < 32) {
		logger.error('🔒 SECURITY ERROR: SESSION_SECRET is not set or too weak!');
		logger.error('   Generate a secure session secret with: openssl rand -base64 64');
		logger.error('   Set it in your environment variables: SESSION_SECRET=<generated-secret>');
		process.exit(1);
	}

	const sessionConfig = {
	secret: sessionSecret,
	resave: false,
	saveUninitialized: false,
	rolling: true,
	name: 'sessionId',
	cookie: {
		maxAge: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours default
		secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true',
		httpOnly: true,
		sameSite: 'strict' // Enhanced CSRF protection
	},
	store: sessionStore
	};

	// Configure session store based on availability
	if (sessionStore) {
		sessionConfig.store = sessionStore;
		if (redisConnected) {
			logger.info('✅ Using Redis session store');
		} else {
			logger.info('✅ Using file-based session store');
		}
	} else {
		logger.warn('⚠️ Using memory session store (sessions will not persist)');
	}

	app.use(session(sessionConfig));

	// Flash messages
	app.use(flash());

	// Add CSRF token to all requests (must come after session middleware)
	app.use(addCSRFToken);

	// Import routes and middleware
	const authRoutes = require('./routes/authRoutes');
	const itemRoutes = require('./routes/itemRoutes');
	const employeeRoutes = require('./routes/employeeRoutes');
	const reportRoutes = require('./routes/reportRoutes');
	const referenceRoutes = require('./routes/referenceRoutes');
	const softwareRoutes = require('./routes/softwareRoutes');
	const departmentRoutes = require('./routes/departmentRoutes');
	const adminRoutes = require('./routes/adminRoutes');

	const apiRoutes = require('./routes/apiRoutes');

	// Middleware chain - ensure messages are always available
	app.use((req, res, next) => {
	  res.locals.messages = req.flash() || {};
	  res.locals.can = typeof req.can === 'function' ? req.can : () => false;

	  // Ensure message structure is consistent
	  if (!res.locals.messages.error) res.locals.messages.error = [];
	  if (!res.locals.messages.success) res.locals.messages.success = [];
	  if (!res.locals.messages.info) res.locals.messages.info = [];

	  next();
	});

	app.use(loadUserPermissions);
	app.use(languageSwitcher);
	app.use(translationMiddleware);

	// Global template variables
	app.use((req, res, next) => {
	  const user = req.user || req.session?.user || { settings: {} };
	  res.locals.user = user;
	  res.locals.success = req.flash('success');
	  res.locals.error = req.flash('error');
	  res.locals.errors = req.flash('error');
	  res.locals.info = req.flash('info');
	  res.locals.NODE_ENV = process.env.NODE_ENV;
	  next();
	});

	app.use(addPermissionHelpers);

	// Health check endpoint with reduced logging
	let lastHealthCheckLog = 0;
	const healthCheckLogInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

	app.get('/health', (req, res) => {
	  const now = Date.now();
	  const healthCheck = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV,
		version: require('../package.json').version,
		services: {
		  redis: redisConnected ? 'connected' : 'disconnected'
		},
		memory: process.memoryUsage(),
		pid: process.pid
	  };

	  const statusCode = redisConnected ? 200 : 503;

	  // Only log health check once per day or if there are issues
	  if (now - lastHealthCheckLog > healthCheckLogInterval || statusCode !== 200) {
		logger.info('📊 Daily Health Check:', {
		  status: healthCheck.status,
		  uptime: Math.floor(healthCheck.uptime / 3600) + 'h',
		  services: healthCheck.services,
		  memoryUsage: Math.round(healthCheck.memory.heapUsed / 1024 / 1024) + 'MB'
		});
		lastHealthCheckLog = now;
	  }

	  res.status(statusCode).json(healthCheck);
	});

	// Routes setup

	// Routes setup with enhanced security
	app.use('/auth', loginRateLimit, accountLockout.createMiddleware(), authRoutes);
	app.use('/api', apiRateLimit, csrfProtection, apiRoutes);
	app.use('/api/analytics', require('./routes/analytics')); // Analytics routes (no CSRF for tracking)
	app.use('/admin', adminRoutes);

	// Register main asset routes before license validation
	app.use('/clients', clientRoutes);
	app.use('/printers', printerRoutes);
	app.use('/pdas', pdaRoutes);
	app.use('/simcards', simCardRoutes);

	app.use(requireValidLicense);

	// Apply CSRF protection to state-changing routes
	app.use('/items', csrfProtection, itemRoutes);
	app.use('/employees', csrfProtection, employeeRoutes);
	app.use('/reports', reportRoutes); // Read-only, no CSRF needed
	app.use('/references', csrfProtection, referenceRoutes);
	app.use('/software', csrfProtection, softwareRoutes);
	app.use('/departments', csrfProtection, departmentRoutes);
	app.use('/', routes);

	// 404 handler
	app.use((req, res) => {
	  logger.warn(`404 - Page not found: ${req.method} ${req.url}`);
	  res.status(404).render('layout', {
		title: 'Page Not Found',
		body: 'error-content',
		error: 'The page you requested does not exist.',
		status: 404,
		user: req.session && req.session.user ? req.session.user : null
	  });
	});

	// Global error handler
	const DEVELOPER_USER_ID = 3;
	app.use((err, req, res, next) => {
	  logger.error('Global error handler:', {
		error: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		user: req.session?.user?.id || null,
		userAgent: req.get('User-Agent'),
		ip: req.ip
	  });

	  // Don't expose error details in production
	  const message = process.env.NODE_ENV === 'production'
		? 'Something went wrong on our end.'
		: err.message;

	  // Check if it's an AJAX request
	  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

	  if (isAjax) {
		res.status(err.status || 500).json({
		  error: message,
		  status: err.status || 500
		});
	  } else {
		res.status(err.status || 500).render('layout', {
		  title: 'Server Error',
		  body: 'error-content',
		  error: message,
		  status: err.status || 500,
		  user: req.session && req.session.user ? req.session.user : null
		});
	  }
	});

	// Initialize license validation
	const { licenseValidator } = require('./middleware/licenseValidator');
	try {
	  const licenseStatus = await licenseValidator.checkLicense();
	  logger.info('License Status:', licenseStatus.status);
	  if (licenseStatus.status === 'active') {
		logger.info(`Licensed to: ${licenseStatus.company}`);
		logger.info(`Valid until: ${licenseStatus.valid_until}`);
	  } else {
		logger.warn('License Issue:', licenseStatus.msg);
		logger.warn('Only administrator access will be available.');
	  }

	  // Start daily license validation
	  licenseValidator.startDailyCheck();
	} catch (err) {
	  logger.error('License check failed:', err.message);
	}

	// Graceful shutdown handlers
	const gracefulShutdown = (signal) => {
	  logger.info(`🛑 ${signal} received, shutting down gracefully...`);

	  // Stop accepting new requests
	  server.close(() => {
		logger.info('✅ HTTP server closed');

		// Stop warranty scheduler
		try {
		  const warrantyScheduler = require('./services/warrantyScheduler');
		  if (warrantyScheduler) {
			warrantyScheduler.stop();
			logger.info('✅ Warranty scheduler stopped');
		  }
		} catch (error) {
		  logger.error('❌ Error stopping warranty scheduler:', error);
		}

		// Stop backup scheduler
		try {
		  const backupScheduler = require('./services/backupScheduler');
		  if (backupScheduler) {
			backupScheduler.stop();
			logger.info('✅ Backup scheduler stopped');
		  }
		} catch (error) {
		  logger.error('❌ Error stopping backup scheduler:', error);
		}

		// Close Redis connection
		if (redisClient && redisConnected) {
		  redisClient.quit().then(() => {
			logger.info('✅ Redis connection closed');
			process.exit(0);
		  }).catch((error) => {
			logger.error('❌ Error closing Redis connection:', error);
			process.exit(1);
		  });
		} else {
		  process.exit(0);
		}
	  });

	  // Force shutdown after 30 seconds
	  setTimeout(() => {
		logger.error('❌ Forced shutdown after 30 seconds');
		process.exit(1);
	  }, 30000);
	};

	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
	process.on('SIGINT', () => gracefulShutdown('SIGINT'));

	// Handle uncaught exceptions
	process.on('uncaughtException', (err) => {
	  logger.error('❌ Uncaught Exception:', err);
	  gracefulShutdown('UNCAUGHT_EXCEPTION');
	});

	process.on('unhandledRejection', (reason, promise) => {
	  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
	  gracefulShutdown('UNHANDLED_REJECTION');
	});

	// Start HTTP server
	const server = app.listen(PORT, '0.0.0.0', () => {
	  // Console output for immediate container log visibility
	  console.log('🚀 IT Asset Manager started successfully');
	  console.log(`🌐 HTTP Server running on port ${PORT}`);
	  console.log(`📦 Environment: ${process.env.NODE_ENV}`);

	  // Winston logging (may also go to console based on config)
	  logger.info(`🚀 IT Asset Manager started successfully`);
	  logger.info(`📦 Environment: ${process.env.NODE_ENV}`);
	  logger.info(`🌐 HTTP Server running on port ${PORT}`);
	  logger.info(`📊 Session Store: ${sessionStore ? 'Redis' : 'Memory'}`);
	  logger.info(`🔗 Redis: ${redisConnected ? '✅ Connected' : '❌ Disconnected'}`);
	  logger.info(`🔧 Process ID: ${process.pid}`);

	  // Start warranty scheduler
	  setTimeout(async () => {
		try {
		  const warrantyScheduler = require('./services/warrantyScheduler');
		  warrantyScheduler.start();
		  logger.info('⏰ Warranty scheduler started');
		} catch (error) {
		  logger.error('❌ Failed to start warranty scheduler:', error);
		}

		// Start backup scheduler
		try {
		  const backupScheduler = require('./services/backupScheduler');
		  backupScheduler.start();
		  logger.info('⏰ Database backup scheduler started');
		} catch (error) {
		  logger.error('❌ Failed to start backup scheduler:', error);
		}

		// Setup daily status reporting with connection checks
		setupDailyStatusReport();
	  }, 3000);
	});

	// Set server timeout
	server.timeout = 30000; // 30 seconds
	server.keepAliveTimeout = 65000; // 65 seconds
	server.headersTimeout = 66000; // 66 seconds

	return server;
  } catch (error) {
	logger.error('❌ Failed to start application:', error);
	process.exit(1);
  }
};

// Start the application
startApplication().catch(error => {
  console.error('❌ Application startup failed:', error);
  process.exit(1);
});

module.exports = app;
