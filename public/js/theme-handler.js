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
        updateThemeToggleIcons();
      }
    });
  }
  
  // Store the original preference for auto-switching
  body.setAttribute('data-theme-preference', currentTheme);
  
  // Update toggle button icons on initialization
  setTimeout(updateThemeToggleIcons, 100);
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
      setTheme(selectedTheme);
      saveThemePreference(selectedTheme);
    });
  }
  
  // Handle any theme toggle buttons
  const themeToggles = document.querySelectorAll('[data-theme-toggle]');
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const body = document.body;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      setTheme(newTheme);
      saveThemePreference(newTheme);
      
      // Update settings form if present
      const themeSelector = document.getElementById('theme');
      if (themeSelector) {
        themeSelector.value = newTheme;
      }
    });
  });
  
  // Update toggle button icons
  updateThemeToggleIcons();
}

// Utility function to get current theme
function getCurrentTheme() {
  return document.body.getAttribute('data-theme');
}



// Function to update theme toggle button icons
function updateThemeToggleIcons() {
  const themeToggles = document.querySelectorAll('[data-theme-toggle]');
  const currentTheme = getCurrentTheme();
  
  themeToggles.forEach(toggle => {
    const icon = toggle.querySelector('i');
    if (icon) {
      if (currentTheme === 'dark') {
        icon.className = 'fas fa-sun';
        toggle.title = 'Switch to light mode';
      } else {
        icon.className = 'fas fa-moon';
        toggle.title = 'Switch to dark mode';
      }
    }
  });
}

// Function to save theme preference to server
function saveThemePreference(theme) {
  // Only save if user is logged in
  const userDataElement = document.getElementById('user-data');
  if (userDataElement) {
    fetch('/users/settings/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme }),
    }).catch(error => {
      console.warn('Failed to save theme preference:', error);
    });
  }
  
  // Also save to localStorage as fallback
  localStorage.setItem('theme-preference', theme);
}

// Enhanced setTheme function
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
  
  // Update toggle button icons
  updateThemeToggleIcons();
}

// Export functions for use in other scripts
window.themeHandler = {
  getCurrentTheme,
  setTheme,
  initializeTheme,
  setupThemeToggling,
  updateThemeToggleIcons,
  saveThemePreference
};
