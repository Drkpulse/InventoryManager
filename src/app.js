const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const routes = require('./routes');
const i18n = require('./config/i18n');
const { isAuthenticated } = require('./middleware/auth');

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

// Add AJAX response middleware
const handleAjaxResponse = require('./middleware/ajaxResponse');

// Add notification routes BEFORE the main routes
const notificationRoutes = require('./routes/notificationRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Import warranty scheduler
const warrantyScheduler = require('./services/warrantyScheduler');

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares - CRITICAL ORDER
app.use(express.static(path.join(__dirname, '../public')));

// BODY PARSING MIDDLEWARE - MUST BE FIRST
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// DEBUG MIDDLEWARE - Add this temporarily to see what's happening
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('=== DEBUG MIDDLEWARE ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body:', req.body);
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('======================');
  }
  next();
});

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

// Add AJAX response handling middleware
app.use(handleAjaxResponse);

// CRITICAL: Load permissions BEFORE adding helpers
app.use(loadUserPermissions);

// Global template variables and permission helpers
app.use((req, res, next) => {
  const user = req.user || req.session?.user || { settings: {} };
  const lang = user?.settings?.language || req.session?.language || 'en';

  res.locals.t = (key) =>
    translations[lang]?.[key] ||
    translations['en'][key] ||
    key;
  res.locals.user = user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');
  next();
});

// Add permission helper functions AFTER loading permissions
app.use(addPermissionHelpers);

// Add i18n middleware
app.use(i18n.init);

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Add admin routes
const adminRoutes = require('./routes/adminRoutes');

// Add notification routes BEFORE main routes
app.use('/notifications', isAuthenticated, notificationRoutes);
app.use('/api', apiRoutes);

// Routes - AUTH ROUTES FIRST
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);  // Add admin routes
app.use('/items', itemRoutes);
app.use('/employees', employeeRoutes);
app.use('/reports', reportRoutes);
app.use('/references', referenceRoutes);
app.use('/software', softwareRoutes);
app.use('/departments', departmentRoutes);

// Use main routes AFTER notification routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you requested does not exist.',
    user: req.session && req.session.user ? req.session.user : null
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: req.session && req.session.user ? req.session.user : null
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start warranty scheduler after server is running
  setTimeout(() => {
    try {
      warrantyScheduler.start();
    } catch (error) {
      console.error('Failed to start warranty scheduler:', error);
    }
  }, 5000); // 5 second delay to ensure database is ready
});

module.exports = app;
