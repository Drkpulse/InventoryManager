const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const itemRoutes = require('./itemRoutes');
const employeeRoutes = require('./employeeRoutes');
const departmentRoutes = require('./departmentRoutes');
const reportRoutes = require('./reportRoutes');
const adminRoutes = require('./adminRoutes');
const referenceRoutes = require('./referenceRoutes');
const userRoutes = require('./userRoutes');
const apiRoutes = require('./apiRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const clientRoutes = require('./clientRoutes');
const printerRoutes = require('./printerRoutes');
const pdaRoutes = require('./pdaRoutes');

// Dashboard route
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

// Dashboard - home page
router.get('/', isAuthenticated, dashboardController.getDashboard);

// Dashboard routes - these need to come before the general dashboard route
router.use('/dashboard', isAuthenticated, dashboardRoutes);

// Mount routes
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/references', referenceRoutes);
router.use('/users', userRoutes);
router.use('/api', apiRoutes);
router.use('/clients', clientRoutes);
router.use('/printers', printerRoutes);
router.use('/pdas', pdaRoutes);

// 404 handling for API routes
router.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

module.exports = router;
