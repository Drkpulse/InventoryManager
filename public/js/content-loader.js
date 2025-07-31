document.addEventListener('DOMContentLoaded', function() {
  setupContentLoader();
});

function setupContentLoader() {
  // Set up content loading for all internal links without data-no-ajax
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a:not([data-no-ajax])');

    if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      // Skip external links, hash links, or javascript links
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:') ||
          href.startsWith('tel:') || href.startsWith('mailto:') || link.getAttribute('target') === '_blank') {
        return;
      }

      e.preventDefault();
      loadContent(href);
    }
  });

  // Handle browser back/forward
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.path) {
      loadContent(event.state.path, false);
    }
  });

  // Handle form submissions that should use AJAX
  document.addEventListener('submit', function(event) {
    const form = event.target;

    // Check if the form has the data-no-ajax attribute or if any parent element has the attribute
    let element = form;
    while (element && !element.hasAttribute('data-no-ajax')) {
      element = element.parentElement;
    }

    // If data-no-ajax attribute is found, don't intercept the form submission
    if (element && element.hasAttribute('data-no-ajax')) {
      console.log('Form has data-no-ajax attribute, using regular submission');
      return; // Let the form submit normally
    }

    event.preventDefault();

    const formData = new FormData(form);
    const method = form.getAttribute('method') || 'POST';
    const action = form.getAttribute('action') || window.location.pathname;

    // Show loading indicator
    showLoadingIndicator();

    // Send the form data
    fetch(action, {
      method: method,
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(response => {
      // Check if response is redirecting
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      // Check content type to determine how to handle response
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        // For non-JSON responses (like HTML redirects), redirect to the URL
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        // If it's a successful HTML response, redirect to the current URL
        window.location.href = response.url || action;
        return;
      }
    })
    .then(data => {
      // Only process if we got JSON data
      if (data) {
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }

        // Update content
        updatePageContent(data);

        // Update URL if this wasn't a POST request
        if (method.toUpperCase() !== 'POST') {
          window.history.pushState({path: action}, data.title || '', action);
        }
      }
    })
    .catch(error => {
      console.error('Error submitting form:', error);
      hideLoadingIndicator();

      // For form submissions, fall back to regular form submission
      console.log('Falling back to regular form submission');
      form.submit();
    });
  });
}

function loadContent(url, updateHistory = true) {
  // Show loading indicator
  showLoadingIndicator();

  fetch(url, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Handle redirects
    if (data.redirect) {
      window.location.href = data.redirect;
      return;
    }

    // Update page content
    updatePageContent(data);

    // Update browser history
    if (updateHistory) {
      window.history.pushState({path: url}, data.title || '', url);
    }
  })
  .catch(error => {
    console.error('Error loading content:', error);
    hideLoadingIndicator();
    // Fallback to traditional navigation on error
    window.location.href = url;
  });
}

function updatePageContent(data) {
  // Update page title
  if (data.title) {
    document.title = data.title;
  }

  // Update main content
  const mainContent = document.getElementById('mainContent');
  if (mainContent && data.content) {
    mainContent.innerHTML = data.content;

    // Execute scripts in the new content
    const scripts = mainContent.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  // Update active menu items
  updateActiveMenuItems();

  // Hide loading indicator
  hideLoadingIndicator();

  // Run any initialization code
  if (typeof initializeUI === 'function') {
    initializeUI();
  }
}

const loadingOverlay = document.getElementById('loadingOverlay');
function showLoadingIndicator() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('active');
  }
}
function hideLoadingIndicator() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('active');
  }
}

// After content is loaded, update the active menu item
function updateActiveMenuItems() {
  // Get the current path
  const currentPath = window.location.pathname;

  // Remove active class from all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Find and activate the correct menu item based on the path
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkPath = link.getAttribute('href');

    // Exact match for the current path
    if (linkPath === currentPath) {
      link.classList.add('active');
      return;
    }

    // Handle nested routes (like /departments/1) - activate the parent section
    if (currentPath.startsWith(linkPath) && linkPath !== '/' &&
        (currentPath.charAt(linkPath.length) === '/' || linkPath.endsWith('/'))) {
      link.classList.add('active');
      return;
    }

    // Special case for dashboard
    if ((currentPath === '/' || currentPath === '/dashboard') &&
        (linkPath === '/' || linkPath === '/dashboard')) {
      link.classList.add('active');
      return;
    }
  });
}

// Call this function after any content is loaded or navigation happens
document.addEventListener('DOMContentLoaded', function() {
  updateActiveMenuItems();
});

// Add event listener for content loaded event
document.addEventListener('content-loaded', updateActiveMenuItems);

// Global search functionality - only add if elements exist
function setupGlobalSearch() {
  const searchInput = document.getElementById('globalSearch');
  const searchContainer = document.querySelector('.search-container');

  if (searchInput && searchContainer) {
    // Create search results container if it doesn't exist
    let searchResults = searchContainer.querySelector('.search-results');
    if (!searchResults) {
      searchResults = document.createElement('div');
      searchResults.className = 'search-results';
      searchContainer.appendChild(searchResults);
    }

    // Add event listener to close search results when clicking outside
    document.addEventListener('click', function(e) {
      if (!searchContainer.contains(e.target)) {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
      }
    });

    // Clear search results when input is cleared or escape is pressed
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
        this.value = '';
      }
    });
  }
}

// Initialize global search when DOM is ready or content is updated
document.addEventListener('DOMContentLoaded', setupGlobalSearch);
document.addEventListener('content-loaded', setupGlobalSearch);
