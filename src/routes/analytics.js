/**
 * Analytics API Routes
 * Routes for handling user behavior and performance analytics
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Middleware to check if analytics tracking is enabled
const checkAnalyticsConsent = (req, res, next) => {
  // Check if user has consented to analytics cookies
  const analyticsConsent = req.cookies?.analytics_consent;
  const cookieConsent = req.cookies?.cookie_consent;
  
  // Allow tracking if user has consented or if it's an admin user
  if (analyticsConsent === 'true' || cookieConsent === 'accepted' || req.session?.user?.is_admin) {
    next();
  } else {
    // Still accept the data but don't process it for privacy compliance
    res.status(200).json({ success: true, message: 'No consent for analytics tracking' });
  }
};

// Event tracking endpoint
router.post('/event', checkAnalyticsConsent, analyticsController.trackEvent);

// Performance metrics endpoint
router.post('/performance', checkAnalyticsConsent, analyticsController.trackPerformance);

// Cookie consent tracking endpoint (always allowed as it tracks consent itself)
router.post('/cookie-consent', analyticsController.trackCookieConsent);

// Session end tracking endpoint
router.post('/session-end', checkAnalyticsConsent, analyticsController.trackSessionEnd);

// Analytics data retrieval endpoint (admin only)
router.get('/data', (req, res, next) => {
  if (!req.session?.user?.is_admin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}, analyticsController.getAnalytics);

module.exports = router;
