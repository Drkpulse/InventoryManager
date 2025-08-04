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

// Add notification routes
const notificationRoutes = require('./routes/notificationRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Import warranty scheduler
const warrantyScheduler = require('./services/warrantyScheduler');

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares - CRITICAL ORDER
app.use(express.static(path.join(__dirname, '../public')));

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

// Add flash messages to res.locals for all views
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Load permissions
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

// Add permission helper functions
app.use(addPermissionHelpers);

// Add i18n middleware
app.use(i18n.init);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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
  }, 5000);
});

module.exports = app;
