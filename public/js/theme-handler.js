// Theme Handler - Manages light/dark mode switching
document.addEventListener('DOMContentLoaded', function() {
  initializeTheme();
  setupThemeToggling();
});

function initializeTheme() {
  const body = document.body;
  let currentTheme = body.getAttribute('data-theme');
  
  // Check for theme from cookie (for immediate updates)
  const cookieTheme = getCookie('user_theme');
  if (cookieTheme && cookieTheme !== currentTheme) {
    currentTheme = cookieTheme;
    body.setAttribute('data-theme', currentTheme);
  }
  
  // If theme is auto, detect system preference
  if (currentTheme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addListener(function(e) {
      if (body.getAttribute('data-theme-preference') === 'auto') {
        body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }
  
  // Store the original preference for auto-switching
  body.setAttribute('data-theme-preference', currentTheme);
}

// Helper function to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setupThemeToggling() {
  // Handle theme selector in settings
  const themeSelector = document.getElementById('theme');
  if (themeSelector) {
    themeSelector.addEventListener('change', function() {
      const selectedTheme = this.value;
      const body = document.body;
      
      if (selectedTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        body.setAttribute('data-theme', selectedTheme);
      }
      
      body.setAttribute('data-theme-preference', selectedTheme);
    });
  }
  
  // Handle any theme toggle buttons
  const themeToggles = document.querySelectorAll('[data-theme-toggle]');
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const body = document.body;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      body.setAttribute('data-theme', newTheme);
      body.setAttribute('data-theme-preference', newTheme);
      
      // Update settings form if present
      const themeSelector = document.getElementById('theme');
      if (themeSelector) {
        themeSelector.value = newTheme;
      }
    });
  });
}

// Utility function to get current theme
function getCurrentTheme() {
  return document.body.getAttribute('data-theme');
}

// Utility function to set theme
function setTheme(theme) {
  const body = document.body;
  
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    body.setAttribute('data-theme', theme);
  }
  
  body.setAttribute('data-theme-preference', theme);
  
  // Update any theme selectors
  const themeSelector = document.getElementById('theme');
  if (themeSelector) {
    themeSelector.value = theme;
  }
}

// Export functions for use in other scripts
window.themeHandler = {
  getCurrentTheme,
  setTheme,
  initializeTheme,
  setupThemeToggling
};
