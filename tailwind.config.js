/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.ejs',
    './src/views/**/*.html',
    './src/views/**/*.js',
    './public/**/*.js',
    './public/**/*.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#4a6fa5',  // Your main primary color
          600: '#3d5a87',
          700: '#334a73',
          800: '#2a3d5f',
          900: '#1d2d42'
        },
        secondary: {
          50: '#e6f2f5',
          100: '#b3d9e0',
          200: '#80c0cb',
          300: '#4da7b6',
          400: '#338fa2',
          500: '#166088',  // Your main secondary color
          600: '#135270',
          700: '#104458',
          800: '#0d3640',
          900: '#0a2828'
        },
        danger: '#e63946',
        success: '#2a9d8f',
        warning: '#f6c23e',
        info: '#36b9cc'
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif']
      }
    },
  },
  plugins: [],
}

