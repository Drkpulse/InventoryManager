/**
 * SPA Navigation - Handles page transitions without full page reloads
 */
document.addEventListener('DOMContentLoaded', function() {
  let currentPath = window.location.pathname;

  // Function to load content via AJAX
  async function loadContent(url) {
    try {
      showLoadingIndicator();

      console.log('Loading content via AJAX:', url);

      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // Handle the response
      let data;
      const contentType = response.headers.get('Content-Type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // For HTML responses, redirect
        window.location.href = url;
        return;
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

      // Fallback to full page load
      window.location.href = url;
    }
  }

  // Handle navigation response
  function handleNavigationResponse(responseData, url) {
    // Update document title
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

    // Update the URL in browser history
    window.history.pushState({}, responseData.title, url);

    // CRITICAL: Re-initialize all page components
    if (typeof window.initializePageComponents === 'function') {
      setTimeout(() => {
        window.initializePageComponents();
      }, 100); // Small delay to ensure DOM is ready
    }

    // Dispatch event that content has been loaded
    document.dispatchEvent(new CustomEvent('content-loaded'));

    // Hide loading overlay
    hideLoadingIndicator();
  }

  // Function to execute scripts in the new content
  function executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(script => {
      const newScript = document.createElement('script');

      Array.from(script.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });

      newScript.textContent = script.textContent;
      script.parentNode.replaceChild(newScript, script);
    });
  }

  // Show/hide loading indicators
  function showLoadingIndicator() {
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

    setTimeout(() => {
      loadingOverlay.classList.add('active');
    }, 10);
  }

  function hideLoadingIndicator() {
    const loadingOverlay = document.getElementById('spaLoadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
      setTimeout(() => {
        if (loadingOverlay.parentNode && !loadingOverlay.classList.contains('active')) {
          loadingOverlay.parentNode.removeChild(loadingOverlay);
        }
      }, 300);
    }
  }

  // Update active menu items
  function updateActiveMenuItems(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPath = link.getAttribute('href');

      if (linkPath === path) {
        link.classList.add('active');
        return;
      }

      if (path.startsWith(linkPath) && linkPath !== '/' && path.charAt(linkPath.length) === '/') {
        link.classList.add('active');
      }
    });

    if (path === '/') {
      const dashboardLink = document.querySelector('.nav-link[href="/"]');
      if (dashboardLink) {
        dashboardLink.classList.add('active');
      }
    }
  }

  // Handle all internal navigation link clicks
  document.addEventListener('click', function(event) {
    const link = event.target.closest('a');

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

  // Expose functions globally
  window.loadContent = loadContent;
  window.showLoadingIndicator = showLoadingIndicator;
  window.hideLoadingIndicator = hideLoadingIndicator;
});
