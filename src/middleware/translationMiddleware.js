const { translate, supportedLanguages } = require('../utils/translations');
const db = require('../config/db');

async function translationMiddleware(req, res, next) {
  let userLanguage = 'pt';

  // If user is logged in, check database for preferred language
  if (req.session && req.session.user && req.session.user.id) {
    try {
      const userId = req.session.user.id;
      const userResult = await db.query('SELECT settings FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0 && userResult.rows[0].settings && userResult.rows[0].settings.language) {
        userLanguage = userResult.rows[0].settings.language;
      }
    } catch (err) {
      console.error('Error fetching user language from DB:', err);
    }
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

    for (const lang of acceptedLanguages) {
      if (supportedLanguages.includes(lang)) {
        userLanguage = lang;
        break;
      }
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

  req.language = userLanguage;
  if (req.session) {
    req.session.language = userLanguage;
  }

  res.locals.t = (key, lang = userLanguage) => translate(key, lang);
  res.locals.currentLanguage = userLanguage;
  res.locals.supportedLanguages = supportedLanguages;
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

    // If user is logged in, update their settings in the database
    if (req.user) {
      const db = require('../config/db');
      db.query(
        'UPDATE users SET settings = jsonb_set(settings, \'{"language"}\', $1::jsonb, true), updated_at = NOW() WHERE id = $2',
        [JSON.stringify(lang), req.user.id]
      ).catch(err => {
        console.error('Failed to update user language setting:', err);
      });
      req.user.settings.language = lang;
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
