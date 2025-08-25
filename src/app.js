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
const RedisStore = require('connect-redis');
const redis = require('redis');

// Import application modules
const routes = require('./routes');
const { isAuthenticated } = require('./middleware/auth');
const { translationMiddleware, languageSwitcher } = require('./middleware/translationMiddleware');
const { loadUserPermissions, addPermissionHelpers } = require('./middleware/permissions');
const { requireValidLicense } = require('./middleware/licenseValidator');
const detectAjaxRequest = require('./middleware/ajaxDetection');

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

// Add console logging for non-production
if (process.env.NODE_ENV !== 'production') {
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

const initializeRedis = async () => {
  try {
    logger.info('🔧 Initializing Redis connection...');

    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
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

    await redisClient.connect();
    await redisClient.ping();

    redisConnected = true;
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: 'inv_mgr:',
      ttl: 24 * 60 * 60,
      disableTouch: false,
      disableTTL: false
    });

    logger.info('✅ Redis session store configured successfully');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    logger.info('⚠️ Falling back to memory store for sessions');
    redisConnected = false;
    sessionStore = undefined;
  }
};

// Start application initialization
const startApplication = async () => {
  try {
    await initializeRedis();

    // Trust proxy for production deployments
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
    }

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          connectSrc: ["'self'"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameAncestors: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

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

    // Rate limiting
    const limiter = rateLimit({
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
    app.use(limiter);

    // Strict rate limiting for auth routes
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 600, // limit each IP to 5 requests per windowMs
      message: {
        error: 'Too many authentication attempts, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

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

    // Static files with caching
    app.use(express.static(path.join(__dirname, '../public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
      etag: true,
      lastModified: true
    }));

    // AJAX detection middleware
    app.use(detectAjaxRequest);

    // Body parsing middleware with limits
    app.use(express.urlencoded({
      extended: true,
      limit: '10mb',
      parameterLimit: 1000
    }));
    app.use(express.json({
      limit: '10mb',
      strict: true
    }));

    app.use(methodOverride('_method'));

    // Session configuration
    const sessionConfig = {
      secret: process.env.SESSION_SECRET || (() => {
        logger.error('❌ SESSION_SECRET not set! Using insecure fallback.');
        return 'insecure-fallback-change-me';
      })(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      name: 'sessionId', // Don't use default session name
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES === 'true',
        httpOnly: true,
        sameSite: 'lax'
      }
    };

    if (sessionStore && redisConnected) {
      sessionConfig.store = sessionStore;
      logger.info('✅ Using Redis session store');
    } else {
      logger.warn('⚠️ Using memory session store (Redis not available)');
    }

    app.use(session(sessionConfig));

    // Flash messages
    app.use(flash());

    // Import routes and middleware
    const authRoutes = require('./routes/authRoutes');
    const itemRoutes = require('./routes/itemRoutes');
    const employeeRoutes = require('./routes/employeeRoutes');
    const reportRoutes = require('./routes/reportRoutes');
    const referenceRoutes = require('./routes/referenceRoutes');
    const softwareRoutes = require('./routes/softwareRoutes');
    const departmentRoutes = require('./routes/departmentRoutes');
    const adminRoutes = require('./routes/adminRoutes');
    const notificationRoutes = require('./routes/notificationRoutes');
    const apiRoutes = require('./routes/apiRoutes');

    // Add notification middleware
    const {
      addNotificationHelpers,
      addNotificationCount,
      ensureUserNotificationSettings,
      convertFlashToNotifications
    } = require('./middleware/notificationMiddleware');

    // Initialize notification system
    const { initializeNotificationSystem } = require('./controllers/notificationController');
    let notificationSystemReady = false;

    const initializeNotificationSystemAsync = async () => {
      try {
        logger.info('🔧 Initializing notification system...');
        const result = await initializeNotificationSystem();
        if (result) {
          notificationSystemReady = true;
          logger.info('✅ Notification system initialized successfully');
        } else {
          logger.error('❌ Failed to initialize notification system');
        }
      } catch (error) {
        logger.error('❌ Error initializing notification system:', error);
      }
    };

    // Middleware chain
    app.use((req, res, next) => {
      res.locals.messages = req.flash();
      res.locals.can = typeof req.can === 'function' ? req.can : () => false;
      next();
    });

    app.use(addNotificationHelpers);
    app.use(loadUserPermissions);
    app.use(addNotificationCount);
    app.use(ensureUserNotificationSettings);
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

    app.use(convertFlashToNotifications);
    app.use(addPermissionHelpers);

    // Health check endpoint
    app.get('/health', (req, res) => {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: require('../package.json').version,
        services: {
          redis: redisConnected ? 'connected' : 'disconnected',
          notifications: notificationSystemReady ? 'ready' : 'not ready'
        },
        memory: process.memoryUsage(),
        pid: process.pid
      };

      const statusCode = (redisConnected && notificationSystemReady) ? 200 : 503;
      res.status(statusCode).json(healthCheck);
    });

    // Routes setup
    app.use('/auth', authLimiter, authRoutes);
    app.use('/admin', adminRoutes);
    app.use(requireValidLicense); // License validation for non-admin routes

    app.use('/notifications', isAuthenticated, notificationRoutes);
    app.use('/api', apiRoutes);
    app.use('/items', itemRoutes);
    app.use('/employees', employeeRoutes);
    app.use('/reports', reportRoutes);
    app.use('/references', referenceRoutes);
    app.use('/software', softwareRoutes);
    app.use('/departments', departmentRoutes);
    app.use('/', routes);

    // 404 handler
    app.use((req, res) => {
      logger.warn(`404 - Page not found: ${req.method} ${req.url}`);
      res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you requested does not exist.',
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

      // Create notification if system is ready
      if (notificationSystemReady && req.createNotification) {
        try {
          req.createNotification({
            type_name: 'security_alert',
            user_id: DEVELOPER_USER_ID,
            title: 'System Error Occurred',
            message: err.message,
            data: {
              error: err.message,
              stack: process.env.NODE_ENV === 'production' ? '[Hidden in production]' : err.stack,
              url: req.url,
              method: req.method,
              timestamp: new Date().toISOString(),
              user: req.session?.user?.id || null
            }
          });
        } catch (notificationError) {
          logger.error('Failed to create error notification:', notificationError);
        }
      }

      // Don't expose error details in production
      const message = process.env.NODE_ENV === 'production'
        ? 'Something went wrong on our end.'
        : err.message;

      res.status(err.status || 500).render('error', {
        title: 'Server Error',
        message: message,
        user: req.session && req.session.user ? req.session.user : null
      });
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

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 IT Asset Manager started successfully`);
      logger.info(`📦 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 Server running on port ${PORT}`);
      logger.info(`📊 Session Store: ${sessionStore ? 'Redis' : 'Memory'}`);
      logger.info(`🔗 Redis: ${redisConnected ? '✅ Connected' : '❌ Disconnected'}`);
      logger.info(`🔧 Process ID: ${process.pid}`);

      // Initialize notification system after server starts
      setTimeout(async () => {
        await initializeNotificationSystemAsync();
        logger.info(`📊 Notification system: ${notificationSystemReady ? '✅ Ready' : '❌ Not Ready'}`);

        // Start warranty scheduler
        if (notificationSystemReady) {
          try {
            const warrantyScheduler = require('./services/warrantyScheduler');
            warrantyScheduler.start();
            logger.info('⏰ Warranty scheduler started');
          } catch (error) {
            logger.error('❌ Failed to start warranty scheduler:', error);
          }
        }
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
