const en = require('./translations/en');
const ptPT = require('./translations/pt-PT.json');
const es = require('./translations/es');
const fr = require('./translations/fr');

const translations = {
  'en': en,
  'es': es,
  'fr': fr,
  'pt-PT': ptPT
};

/**
 * Get a translation string in the specified language
 *
 * @param {string} key - Translation key
 * @param {string} lang - Language code (en, pt-PT, es, fr)
 * @returns {string} - Translated string or key if not found
 */
function translate(key, lang = 'en') {
  if (!key) return '';
  const langData = translations[lang] || translations['en'];
  return langData[key] || key;
}

/**
 * Get all translations for a specific language
 *
 * @param {string} lang - Language code
 * @returns {object} - All translations for the language
 */
function getLanguageTranslations(lang = 'en') {
  return translations[lang] || translations['en'];
}

/**
 * Check if a language is supported
 *
 * @param {string} lang - Language code to check
 * @returns {boolean} - Whether the language is supported
 */
function isLanguageSupported(lang) {
  return supportedLanguages.includes(lang);
}

/**
 * Get the language name in its native form
 *
 * @param {string} lang - Language code
 * @returns {string} - Language name
 */
function getLanguageName(lang) {
  const languageNames = {
    'en': 'English',
    'pt-PT': 'Português',
    'es': 'Español',
    'fr': 'Français'
  };
  return languageNames[lang] || lang;
}

/**
 * Format a translation key with parameters
 *
 * @param {string} key - Translation key
 * @param {object} params - Parameters to replace in the translation
 * @param {string} lang - Language code
 * @returns {string} - Formatted translation
 */
function translateWithParams(key, params = {}, lang = 'en') {
  let translation = translate(key, lang);

  // Replace parameters in the format {{param}}
  Object.keys(params).forEach(param => {
    const regex = new RegExp(`{{${param}}}`, 'g');
    translation = translation.replace(regex, params[param]);
  });

  return translation;
}

module.exports = {
  translate,
  getLanguageTranslations,
  isLanguageSupported,
  getLanguageName,
  translateWithParams,
  supportedLanguages: ['en', 'pt-PT', 'es', 'fr']
};
