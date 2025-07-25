const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const routes = require('./routes');
// Removed i18n - using custom translation system instead
const { isAuthenticated } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const softwareRoutes = require('./routes/softwareRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const { translations, t } = require('./utils/translations');

// Add AJAX response middleware
const handleAjaxResponse = require('./middleware/ajaxResponse');
const templateHelpers = require('./middleware/templateHelpers');

// Add notification routes BEFORE the main routes
const notificationRoutes = require('./routes/notificationRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add multer for handling multipart/form-data
const multer = require('multer');
const upload = multer();
app.use(upload.none()); // For forms without file uploads

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

// Add template helpers
app.use(templateHelpers);

app.use((req, res, next) => {
  const user = req.user || req.session?.user || { settings: {} };

  const lang = user?.settings?.language || req.session?.language || 'en';

  // Enhanced translation function
  res.locals.t = (key, params = {}) => {
    return t(key, lang, params);
  };

  res.locals.user = user;
  res.locals.currentLanguage = lang;

  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');

  next();
});


// Note: i18n middleware removed - using custom translation system

// Add test routes for debugging
const testRoutes = require('./routes/testRoutes');
app.use('/test', testRoutes);

// Add notification routes BEFORE main routes
app.use('/notifications', isAuthenticated, notificationRoutes);
app.use('/api', apiRoutes);

// Routes
app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/employees', employeeRoutes);
app.use('/reports', reportRoutes);
app.use('/references', referenceRoutes);
app.use('/software', softwareRoutes);
app.use('/departments', departmentRoutes);

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: req.session && req.session.user ? req.session.user : null
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
