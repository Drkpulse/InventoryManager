const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['en', 'pt'],
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'en',
  cookie: 'locale',
  autoReload: true,
  objectNotation: true
});

module.exports = i18n;
