/**
 * Theme handler for dark/light mode
 */
(function() {
  // Apply theme on page load
  function applyTheme() {
    // Check for theme in localStorage first
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme) {
      document.body.classList.toggle('dark-mode', storedTheme === 'dark');
      return;
    }

    // If no stored theme, check user settings from data attribute
    const userDataElement = document.getElementById('user-data');
    if (userDataElement && userDataElement.dataset.settings) {
      try {
        const settings = JSON.parse(userDataElement.dataset.settings);
        if (settings.theme) {
          document.body.classList.toggle('dark-mode', settings.theme === 'dark');
          // Save to localStorage for persistence
          localStorage.setItem('theme', settings.theme);
        }
      } catch (error) {
        console.error('Error parsing user settings:', error);
      }
    }
  }

  // Listen for theme changes via form
  function setupThemeListener() {
    const themeSelect = document.getElementById('theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', function() {
        const selectedTheme = this.value;
        document.body.classList.toggle('dark-mode', selectedTheme === 'dark');
        localStorage.setItem('theme', selectedTheme);
      });
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    applyTheme();
    setupThemeListener();
  });

  // For SPA navigation
  if (typeof window.contentLoaderEvents === 'undefined') {
    window.contentLoaderEvents = {};
  }

  window.contentLoaderEvents.afterContentLoaded = function() {
    applyTheme();
    setupThemeListener();
  };
})();
