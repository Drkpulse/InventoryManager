module.exports = {
  // Check if user is authenticated
  isAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      return next();
    }
    res.redirect('/auth/login');
  },

  // Check if user is an admin
  isAdmin: (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
      return next();
    }
    res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You do not have permission to access this resource',
      user: req.session.user
    });
  }
};
