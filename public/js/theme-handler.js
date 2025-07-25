/**
 * Theme Handler for IT Asset Manager
 * Handles dark/light mode switching and persistence
 */

class ThemeHandler {
  constructor() {
    this.themeKey = 'itam-theme';
    this.themes = {
      LIGHT: 'light',
      DARK: 'dark',
      AUTO: 'auto'
    };
    
    this.init();
  }

  init() {
    // Get saved theme preference or default to auto
    this.currentTheme = this.getSavedTheme() || this.themes.AUTO;
    
    // Apply the theme
    this.applyTheme(this.currentTheme);
    
    // Add theme toggle button if it doesn't exist
    this.createThemeToggle();
    
    // Listen for system theme changes
    this.watchSystemTheme();
  }

  getSavedTheme() {
    try {
      return localStorage.getItem(this.themeKey);
    } catch (e) {
      console.warn('Could not access localStorage for theme preference');
      return null;
    }
  }

  saveTheme(theme) {
    try {
      localStorage.setItem(this.themeKey, theme);
    } catch (e) {
      console.warn('Could not save theme preference to localStorage');
    }
  }

  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.themes.DARK;
    }
    return this.themes.LIGHT;
  }

  applyTheme(theme) {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.removeAttribute('data-theme');
    
    switch (theme) {
      case this.themes.LIGHT:
        root.setAttribute('data-theme', 'light');
        break;
      case this.themes.DARK:
        root.setAttribute('data-theme', 'dark');
        break;
      case this.themes.AUTO:
        // Let CSS media query handle it
        const systemTheme = this.getSystemTheme();
        if (systemTheme === this.themes.DARK) {
          root.setAttribute('data-theme', 'dark');
        } else {
          root.setAttribute('data-theme', 'light');
        }
        break;
    }

    this.currentTheme = theme;
    this.updateToggleButton();
  }

  toggleTheme() {
    let nextTheme;
    
    switch (this.currentTheme) {
      case this.themes.LIGHT:
        nextTheme = this.themes.DARK;
        break;
      case this.themes.DARK:
        nextTheme = this.themes.AUTO;
        break;
      case this.themes.AUTO:
        nextTheme = this.themes.LIGHT;
        break;
      default:
        nextTheme = this.themes.AUTO;
    }
    
    this.setTheme(nextTheme);
  }

  setTheme(theme) {
    if (Object.values(this.themes).includes(theme)) {
      this.applyTheme(theme);
      this.saveTheme(theme);
    }
  }

  createThemeToggle() {
    // Check if toggle already exists
    if (document.getElementById('theme-toggle')) {
      return;
    }

    // Find the user menu or header actions to add the toggle
    const userMenu = document.querySelector('.user-menu');
    const headerActions = document.querySelector('.header-actions');
    const targetContainer = userMenu || headerActions;

    if (!targetContainer) {
      return; // No suitable container found
    }

    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'theme-toggle';
    toggleButton.className = 'icon-button theme-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle theme');
    toggleButton.setAttribute('title', 'Toggle theme');
    
    const icon = document.createElement('i');
    toggleButton.appendChild(icon);
    
    const tooltipText = document.createElement('span');
    tooltipText.className = 'sr-only';
    toggleButton.appendChild(tooltipText);

    // Add click handler
    toggleButton.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Insert before other buttons in user menu
    if (userMenu) {
      userMenu.insertBefore(toggleButton, userMenu.firstChild);
    } else {
      headerActions.appendChild(toggleButton);
    }

    this.updateToggleButton();
  }

  updateToggleButton() {
    const toggleButton = document.getElementById('theme-toggle');
    if (!toggleButton) return;

    const icon = toggleButton.querySelector('i');
    const tooltip = toggleButton.querySelector('.sr-only');
    
    if (!icon || !tooltip) return;

    // Update icon and tooltip based on current theme
    switch (this.currentTheme) {
      case this.themes.LIGHT:
        icon.className = 'fas fa-sun';
        toggleButton.setAttribute('title', 'Light mode (click for dark)');
        tooltip.textContent = 'Switch to dark mode';
        break;
      case this.themes.DARK:
        icon.className = 'fas fa-moon';
        toggleButton.setAttribute('title', 'Dark mode (click for auto)');
        tooltip.textContent = 'Switch to auto mode';
        break;
      case this.themes.AUTO:
        icon.className = 'fas fa-adjust';
        toggleButton.setAttribute('title', 'Auto mode (click for light)');
        tooltip.textContent = 'Switch to light mode';
        break;
    }
  }

  watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Listen for changes
      mediaQuery.addEventListener('change', () => {
        if (this.currentTheme === this.themes.AUTO) {
          this.applyTheme(this.themes.AUTO);
        }
      });
    }
  }

  // Public API
  getCurrentTheme() {
    return this.currentTheme;
  }

  getAvailableThemes() {
    return Object.values(this.themes);
  }

  isSystemDarkMode() {
    return this.getSystemTheme() === this.themes.DARK;
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.themeHandler = new ThemeHandler();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM not ready yet
} else {
  // DOM is ready
  window.themeHandler = new ThemeHandler();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeHandler;
}
