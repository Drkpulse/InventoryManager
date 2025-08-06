const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const routes = require('./routes');
const i18n = require('./config/i18n');
const { isAuthenticated } = require('./middleware/auth');
const { translationMiddleware, languageSwitcher } = require('./middleware/translationMiddleware');
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const softwareRoutes = require('./routes/softwareRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const translations = require('./utils/translations');
const { loadUserPermissions, addPermissionHelpers } = require('./middleware/permissions');

// Add notification routes and middleware
const notificationRoutes = require('./routes/notificationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const {
  addNotificationHelpers,
  addNotificationCount,
  ensureUserNotificationSettings,
  convertFlashToNotifications
} = require('./middleware/notificationMiddleware');

// Import warranty scheduler
const warrantyScheduler = require('./services/warrantyScheduler');

const detectAjaxRequest = require('./middleware/ajaxDetection');

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares - CRITICAL ORDER
app.use(express.static(path.join(__dirname, '../public')));

// Add AJAX detection middleware BEFORE body parsing
app.use(detectAjaxRequest);

// BODY PARSING MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Flash messages
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Initialize notification system on startup
const { initializeNotificationSystem } = require('./controllers/notificationController');
let notificationSystemReady = false;

// Move this initialization to after routes are set up
const initializeNotificationSystemAsync = async () => {
  try {
    console.log('🔧 Initializing notification system...');
    const { initializeNotificationSystem } = require('./controllers/notificationController');
    const result = await initializeNotificationSystem();
    if (result) {
      notificationSystemReady = true;
      console.log('✅ Notification system initialized successfully');

    } else {
      console.error('❌ Failed to initialize notification system');
    }
  } catch (error) {
    console.error('❌ Error initializing notification system:', error);
  }
};

// Add notification helpers early in middleware chain
app.use(addNotificationHelpers);

// Load permissions
app.use(loadUserPermissions);

// Add notification count to all views (after authentication)
app.use(addNotificationCount);

// Ensure user notification settings exist
app.use(ensureUserNotificationSettings);


// Language switcher middleware
app.use(languageSwitcher);

// Translation middleware
app.use(translationMiddleware);

// Global template variables and permission helpers
app.use((req, res, next) => {
  const user = req.user || req.session?.user || { settings: {} };
  res.locals.user = user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');
  next();
});

// Convert important flash messages to persistent notifications
app.use(convertFlashToNotifications);

// Add permission helper functions
app.use(addPermissionHelpers);

// Add i18n middleware
app.use(i18n.init);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    notificationSystem: notificationSystemReady
  });
});

// Add admin routes
const adminRoutes = require('./routes/adminRoutes');

// Routes
app.use('/notifications', isAuthenticated, notificationRoutes);
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/items', itemRoutes);
app.use('/employees', employeeRoutes);
app.use('/reports', reportRoutes);
app.use('/references', referenceRoutes);
app.use('/software', softwareRoutes);
app.use('/departments', departmentRoutes);

// Use main routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you requested does not exist.',
    user: req.session && req.session.user ? req.session.user : null
  });
});

// Global error handler with notification support
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);

  // Create error notification for authenticated users
  if (req.session?.user?.id && notificationSystemReady) {
    try {
      req.createNotification({
        type_name: 'security_alert',
        user_id: req.session.user.id,
        title: 'System Error Occurred',
        message: 'An error occurred while processing your request. Our team has been notified.',
        data: {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString()
        }
      });
    } catch (notificationError) {
      console.error('Failed to create error notification:', notificationError);
    }
  }

  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: req.session && req.session.user ? req.session.user : null
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  // Stop warranty scheduler
  if (warrantyScheduler) {
    try {
      warrantyScheduler.stop();
      console.log('✅ Warranty scheduler stopped');
    } catch (error) {
      console.error('❌ Error stopping warranty scheduler:', error);
    }
  }

  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');

  // Stop warranty scheduler
  if (warrantyScheduler) {
    try {
      warrantyScheduler.stop();
      console.log('✅ Warranty scheduler stopped');
    } catch (error) {
      console.error('❌ Error stopping warranty scheduler:', error);
    }
  }

  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Start warranty scheduler after server is running and notification system is ready
  setTimeout(async () => {
    await initializeNotificationSystemAsync();
    console.log(`📊 Notification system: ${notificationSystemReady ? '✅ Ready' : '❌ Not Ready'}`);

    // Start warranty scheduler only after notifications are ready
    if (notificationSystemReady) {
      try {
        warrantyScheduler.start();
        console.log('⏰ Warranty scheduler started');
      } catch (error) {
        console.error('❌ Failed to start warranty scheduler:', error);
      }
    }
  }, 2000);
});

module.exports = app;
