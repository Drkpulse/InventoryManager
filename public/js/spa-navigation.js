/**
 * SPA Navigation - Handles page transitions without full page reloads
 */
document.addEventListener('DOMContentLoaded', function() {
  // Store the main content container
  const mainContentContainer = document.querySelector('main');
  let currentPath = window.location.pathname;

  // Function to load content via AJAX
  async function loadContent(url) {
    try {
      // Show loading indicator
      showLoadingIndicator();

      console.log('Loading content via AJAX:', url);

      // Fetch the new page content
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Try to parse as JSON first
      let data;
      const contentType = response.headers.get('Content-Type');

      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
          console.log('Response text:', text);

          // If JSON parsing fails, it might be a redirect response
          if (text.includes('<html') || text.includes('<!DOCTYPE')) {
            window.location.href = url;
            return;
          }

          // Fallback to treating it as HTML
          data = {
            success: true,
            title: document.title,
            content: text,
            bodyClass: ''
          };
        }
      } else {
        // If not JSON, treat as HTML or handle redirect
        const html = await response.text();
        if (html.includes('<html') || html.includes('<!DOCTYPE')) {
          window.location.href = url;
          return;
        }

        data = {
          success: true,
          title: document.title,
          content: html,
          bodyClass: ''
        };
      }

      if (data.success === false) {
        throw new Error(data.message || 'Unknown error occurred');
      }

      // Update current path
      currentPath = url;

      // Update active menu items
      updateActiveMenuItems(new URL(url, window.location.origin).pathname);

      handleNavigationResponse(data, url);
    } catch (error) {
      console.error('Error loading page content:', error);
      hideLoadingIndicator();

      // For serious errors, just reload the page
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        console.log('JSON parsing error, doing full page load');
        window.location.href = url;
        return;
      }

      // Show error message
      mainContentContainer.innerHTML = `
        <div class="alert alert-danger">
          <p>Failed to load content: ${error.message || 'Unknown error'}. Please try again or refresh the page.</p>
          <button class="btn btn-sm" onclick="window.location.reload()">Reload Page</button>
        </div>
      `;
    }
  }

  // Function to update active menu items
  function updateActiveMenuItems(path) {
    // Remove all active classes first
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Find and activate the correct menu item based on the path
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPath = link.getAttribute('href');

      // Exact match
      if (linkPath === path) {
        link.classList.add('active');
        return;
      }

      // Check for section match (e.g., /items/123 should activate /items)
      if (path.startsWith(linkPath) && linkPath !== '/' && path.charAt(linkPath.length) === '/') {
        link.classList.add('active');
      }
    });

    // Special case for dashboard
    if (path === '/') {
      const dashboardLink = document.querySelector('.nav-link[href="/"]');
      if (dashboardLink) {
        dashboardLink.classList.add('active');
      }
    }
  }

  // Function to execute scripts in the new content
  function executeScripts(container) {
    // Find and execute all script tags
    const scripts = container.querySelectorAll('script');
    scripts.forEach(script => {
      const newScript = document.createElement('script');

      // Copy all attributes
      Array.from(script.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // Copy the script content
      newScript.textContent = script.textContent;

      // Replace the old script with the new one to execute it
      script.parentNode.replaceChild(newScript, script);
    });
  }

  // Show loading indicator
  function showLoadingIndicator() {
    // Check if loading overlay exists, create if not
    let loadingOverlay = document.getElementById('spaLoadingOverlay');
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'spaLoadingOverlay';
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      `;
      document.body.appendChild(loadingOverlay);
    }

    // Make visible
    setTimeout(() => {
      loadingOverlay.classList.add('active');
    }, 10); // Small delay to ensure transition works
  }

  // Hide loading indicator
  function hideLoadingIndicator() {
    const loadingOverlay = document.getElementById('spaLoadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');

      // Remove after transition completes
      setTimeout(() => {
        if (loadingOverlay.parentNode && !loadingOverlay.classList.contains('active')) {
          loadingOverlay.parentNode.removeChild(loadingOverlay);
        }
      }, 300);
    }
  }

  // Handle all internal navigation link clicks
  document.addEventListener('click', function(event) {
    const link = event.target.closest('a');

    // Check if it's a valid internal link we should handle
    if (link &&
        link.href &&
        link.href.startsWith(window.location.origin) &&
        !link.hasAttribute('target') &&
        !link.hasAttribute('download') &&
        !link.hasAttribute('data-no-ajax') &&
        !link.href.includes('#') &&
        !link.href.endsWith('.pdf') &&
        !link.href.endsWith('.csv') &&
        !link.href.endsWith('.xlsx')) {

      // Skip login/logout links
      if (link.href.includes('/auth/login') || link.href.includes('/auth/logout')) {
        return;
      }

      event.preventDefault();

      const url = link.href;
      if (url !== currentPath) {
        loadContent(url);
      }
    }
  });

  // Handle form submissions
  document.addEventListener('submit', function(event) {
    const form = event.target;

    // Skip login forms and forms marked to not use AJAX
    if (form.id === 'loginForm' ||
        form.hasAttribute('data-no-ajax') ||
        form.hasAttribute('target') ||
        form.action.includes('/auth/login')) {
      return;
    }

    // Only handle GET forms (POST forms handled by form-handler.js)
    if (form.method.toLowerCase() === 'get') {
      event.preventDefault();

      const formData = new FormData(form);
      const queryString = new URLSearchParams(formData).toString();
      const url = form.action + (form.action.includes('?') ? '&' : '?') + queryString;

      loadContent(url);
    }
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.path) {
      loadContent(event.state.path);
    } else {
      loadContent(window.location.pathname);
    }
  });

  // Initialize by storing current state
  window.history.replaceState({path: window.location.pathname}, '', window.location.pathname);

  // Expose functions globally for form handler and other scripts
  window.loadContent = loadContent;
  window.showLoadingIndicator = showLoadingIndicator;
  window.hideLoadingIndicator = hideLoadingIndicator;

  // Function to process HTML content before inserting it into the DOM
  function processContentForSPA(html) {
    // Create a temporary div to hold the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove any sidebars that might have been included in the response
    const sidebars = tempDiv.querySelectorAll('.sidebar');
    sidebars.forEach(sidebar => sidebar.remove());

    // Remove any headers that might have been included
    const headers = tempDiv.querySelectorAll('.top-header');
    headers.forEach(header => header.remove());

    // Remove any duplicate navigation elements
    const navItems = tempDiv.querySelectorAll('.nav-list');
    if (navItems.length > 1) {
      // Keep only the first one
      for (let i = 1; i < navItems.length; i++) {
        navItems[i].remove();
      }
    }

    // Ensure content uses full width
    const contentContainers = tempDiv.querySelectorAll('.content-container, .card, .row');
    contentContainers.forEach(container => {
      container.style.width = '100%';
      container.style.maxWidth = '100%';
      container.style.margin = '0';
      container.style.padding = '1rem';
    });

    return tempDiv.innerHTML;
  }

  // Update the handleNavigationResponse function
  function handleNavigationResponse(responseData, url) {
    // Update document title if we have one
    if (responseData.title) {
      document.title = responseData.title + ' | IT Asset Manager';
    }

    // Insert the new content
    const mainContent = document.getElementById('mainContent');
    if (mainContent && responseData.content) {
      // Clear existing content and add the new content
      mainContent.innerHTML = responseData.content;

      // Execute any scripts in the new content
      executeScripts(mainContent);
    }

    // Update body class
    if (responseData.bodyClass) {
      document.body.dataset.page = responseData.bodyClass;
    }

    // Handle page type classes
    const appContainer = document.querySelector('.app-container');
    const pageTypes = responseData.pageType || {};

    // Reset all page type classes
    appContainer.classList.remove('dashboard-page', 'reference-page', 'report-page', 'department-page');

    // Apply appropriate classes based on page type
    if (pageTypes.isDashboard) {
      appContainer.classList.add('dashboard-page');
    }

    if (pageTypes.isReferencePage) {
      appContainer.classList.add('reference-page');
    }

    if (pageTypes.isReportPage) {
      appContainer.classList.add('report-page');
    }

    if (pageTypes.isDepartmentPage) {
      appContainer.classList.add('department-page');
    }

    // Update the URL in browser history
    window.history.pushState({}, responseData.title, url);

    // Initialize UI elements in the new content
    if (typeof initializeUI === 'function') {
      initializeUI();
    }

    // Dispatch event that content has been loaded
    document.dispatchEvent(new CustomEvent('content-loaded'));

    // Hide loading overlay
    const spaLoadingOverlay = document.getElementById('spaLoadingOverlay');
    if (spaLoadingOverlay) {
      spaLoadingOverlay.classList.remove('active');
    }
  }
});
