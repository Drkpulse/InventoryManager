// Theme Handler - Manages light/dark mode switching
document.addEventListener('DOMContentLoaded', function() {
  initializeTheme();
  setupThemeToggling();
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function initializeTheme() {
  const body = document.body;
  const html = document.documentElement;
  let currentTheme = body.getAttribute('data-theme') || 'light';

  // Check for theme from cookie (for immediate updates)
  const cookieTheme = getCookie('user_theme');
  if (cookieTheme && cookieTheme !== currentTheme) {
    currentTheme = cookieTheme;
  }

  // Apply theme to both body and html elements
  function applyTheme(theme) {
    body.setAttribute('data-theme', theme);

    // Apply Tailwind dark class
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    // Save theme preference
    setCookie('user_theme', theme);
  }

  // If theme is auto, detect system preference
  if (currentTheme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actualTheme = prefersDark ? 'dark' : 'light';
    applyTheme(actualTheme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (body.getAttribute('data-theme-preference') === 'auto') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  } else {
    applyTheme(currentTheme);
  }

  // Store the original preference for auto-switching
  body.setAttribute('data-theme-preference', currentTheme);
}

function setupThemeToggling() {
  // Handle theme selector in settings
  const themeSelector = document.getElementById('theme');
  if (themeSelector) {
    themeSelector.addEventListener('change', function() {
      const selectedTheme = this.value;
      const body = document.body;
      const html = document.documentElement;

      if (selectedTheme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const actualTheme = prefersDark ? 'dark' : 'light';
        body.setAttribute('data-theme', actualTheme);

        if (actualTheme === 'dark') {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      } else {
        body.setAttribute('data-theme', selectedTheme);

        if (selectedTheme === 'dark') {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      }

      body.setAttribute('data-theme-preference', selectedTheme);
      setCookie('user_theme', selectedTheme);
    });
  }

  // Handle any theme toggle buttons
  const themeToggles = document.querySelectorAll('[data-theme-toggle]');
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const body = document.body;
      const html = document.documentElement;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      body.setAttribute('data-theme', newTheme);
      body.setAttribute('data-theme-preference', newTheme);

      if (newTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }

      setCookie('user_theme', newTheme);

      // Update settings form if present
      const themeSelector = document.getElementById('theme');
      if (themeSelector) {
        themeSelector.value = newTheme;
      }
    });
  });
}

// Initialize theme immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    setupThemeToggling();
  });
} else {
  initializeTheme();
  setupThemeToggling();
}
