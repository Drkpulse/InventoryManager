const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const itemRoutes = require('./routes/itemRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/items', itemRoutes);
app.use('/employees', employeeRoutes);
app.use('/departments', departmentRoutes);
app.use('/references', referenceRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/reports', reportRoutes);

// Home route - redirect to dashboard
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('layout', {
      title: 'IT Asset Manager',
      body: 'home',
      user: null
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
