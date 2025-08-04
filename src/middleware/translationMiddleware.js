/**
 * Translation middleware for Express.js
 * Adds translation functionality to all routes
 */

const { translate, supportedLanguages } = require('../utils/translations');

/**
 * Middleware to add translation support to Express
 */
function translationMiddleware(req, res, next) {
  // Get user's preferred language from:
  // 1. User settings (if logged in)
  // 2. Session
  // 3. Accept-Language header
  // 4. Default to 'en'

  let userLanguage = 'en';

  // Check if user is logged in and has language preference
  if (req.user && req.user.settings && req.user.settings.language) {
    userLanguage = req.user.settings.language;
  }
  // Check session for language preference
  else if (req.session && req.session.language) {
    userLanguage = req.session.language;
  }
  // Check Accept-Language header
  else if (req.headers['accept-language']) {
    const acceptedLanguages = req.headers['accept-language']
      .split(',')
      .map(lang => lang.split(';')[0].trim());

    // Find first supported language
    for (const lang of acceptedLanguages) {
      if (supportedLanguages.includes(lang)) {
        userLanguage = lang;
        break;
      }
      // Check for language without region (e.g., 'pt' from 'pt-BR')
      const baseLang = lang.split('-')[0];
      const matchingLang = supportedLanguages.find(supported =>
        supported.startsWith(baseLang)
      );
      if (matchingLang) {
        userLanguage = matchingLang;
        break;
      }
    }
  }

  // Validate language is supported
  if (!supportedLanguages.includes(userLanguage)) {
    userLanguage = 'en';
  }

  // Store language in request for easy access
  req.language = userLanguage;

  // Store language in session
  if (req.session) {
    req.session.language = userLanguage;
  }

  // Add translation function to response locals for use in templates
  res.locals.t = (key, lang = userLanguage) => translate(key, lang);
  res.locals.currentLanguage = userLanguage;
  res.locals.supportedLanguages = supportedLanguages;

  // Add translation function to request for use in controllers
  req.t = (key, lang = userLanguage) => translate(key, lang);

  next();
}

/**
 * Language switcher middleware for handling language changes
 */
function languageSwitcher(req, res, next) {
  const { lang } = req.query;

  if (lang && supportedLanguages.includes(lang)) {
    // Store in session
    req.session.language = lang;

    // If user is logged in, update their settings
    if (req.user) {
      // This would be handled by the settings controller
      // Just set it in session for now
      req.session.pendingLanguageUpdate = lang;
    }

    // Redirect back to the same page without the lang parameter
    const redirectUrl = req.originalUrl.split('?')[0];
    return res.redirect(redirectUrl);
  }

  next();
}

module.exports = {
  translationMiddleware,
  languageSwitcher
};
