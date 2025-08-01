const { showAddRoleForm } = require('./src/controllers/adminController');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.ejs', './src/views/**/*.html', './src/views/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}

