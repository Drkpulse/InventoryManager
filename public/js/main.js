// Clean main.js with only essential functionality

document.addEventListener('DOMContentLoaded', function() {
  // Fetch notifications if we have a notification toggle
  if (document.querySelector('.notification-toggle')) {
    fetchNotifications();
  }

  // Set up form validation
  setupFormValidation();

  // Initialize UI components
  initializeUI();
});

// Fetch notifications from API
function fetchNotifications() {
  fetch('/api/notifications')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateNotificationBadge(data.notifications);
      }
    })
    .catch(error => console.error('Error fetching notifications:', error));
}

// Update notification badge
function updateNotificationBadge(notifications) {
  const badge = document.querySelector('.notifications .badge');
  if (badge) {
    const unreadCount = notifications.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'block' : 'none';
  }
}

// Basic form validation
function setupFormValidation() {
  const forms = document.querySelectorAll('form[data-validate]');

  forms.forEach(form => {
    form.addEventListener('submit', function(event) {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;

      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add('is-invalid');

          // Create or update error message
          let errorMsg = field.nextElementSibling;
          if (!errorMsg || !errorMsg.classList.contains('error-message')) {
            errorMsg = document.createElement('div');
            errorMsg.classList.add('error-message');
            field.parentNode.insertBefore(errorMsg, field.nextSibling);
          }
          errorMsg.textContent = 'This field is required';
        } else {
          field.classList.remove('is-invalid');
          const errorMsg = field.nextElementSibling;
          if (errorMsg && errorMsg.classList.contains('error-message')) {
            errorMsg.remove();
          }
        }
      });

      if (!isValid) {
        event.preventDefault();
      }
    });
  });
}

// Update the function to handle breadcrumbs
function initializeUI() {
  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert:not(.persistent)');
  if (alerts.length > 0) {
    setTimeout(() => {
      alerts.forEach(alert => {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
          }
        }, 500);
      });
    }, 5000);
  }

  // Set up event handlers for links
  document.querySelectorAll('a:not([data-no-ajax]):not([href^="http"]):not([href^="#"]):not([href^="tel:"]):not([href^="mailto:"])').forEach(link => {
    link.addEventListener('click', function(e) {
      // After clicking a link, update the active state in the sidebar
      setTimeout(() => {
        updateActiveMenuItems();
        updateBreadcrumbs();
      }, 100);
    });
  });

  // Update active menu items based on current URL
  updateActiveMenuItems();

  // Update breadcrumbs based on current page
  updateBreadcrumbs();

  // Setup delete confirmations
  setupDeleteConfirmation();

  // Setup dropdowns
  setupDropdowns();
}

// Add a function to update breadcrumbs
function updateBreadcrumbs() {
  const breadcrumbContainer = document.querySelector('.breadcrumb');
  if (!breadcrumbContainer) return;

  const currentPath = window.location.pathname;
  const title = document.title.split(' |')[0];

  // Clear existing breadcrumb content
  breadcrumbContainer.innerHTML = '';

  // Dashboard is always the root
  if (currentPath === '/' || currentPath === '/dashboard') {
    const span = document.createElement('span');
    span.textContent = 'Dashboard';
    breadcrumbContainer.appendChild(span);
  } else {
    // Add Dashboard link
    const dashboardLink = document.createElement('a');
    dashboardLink.href = '/';
    dashboardLink.textContent = 'Dashboard';
    dashboardLink.setAttribute('data-content-loader', '');
    breadcrumbContainer.appendChild(dashboardLink);

    // Add chevron
    const chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-right';
    breadcrumbContainer.appendChild(chevron);

    // Add current page title
    const currentPage = document.createElement('span');
    currentPage.textContent = title;
    breadcrumbContainer.appendChild(currentPage);
  }
}

// Call initializeUI when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUI);

// Update the sidebar active state based on the current URL
function updateActiveMenuItems() {
  const currentPath = window.location.pathname;

  // Remove active class from all sidebar links
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Find the matching links and add active class
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    const href = link.getAttribute('href');

    // Exact match
    if (href === currentPath) {
      link.classList.add('active');
      return;
    }

    // Special case for dashboard
    if ((currentPath === '/' || currentPath === '/dashboard') &&
        (href === '/' || href === '/dashboard')) {
      link.classList.add('active');
      return;
    }

    // Section match (e.g., /references/asset-types should match /references in sidebar)
    // but only if it's not the root path
    if (href !== '/' &&
        currentPath.startsWith(href) &&
        (currentPath.charAt(href.length) === '/' || href.endsWith('/'))) {
      link.classList.add('active');
    }
  });
}

// Make sure delete buttons work with AJAX
function setupDeleteConfirmation() {
  document.querySelectorAll('.delete-btn').forEach(button => {
    if (!button.hasListener) {
      button.hasListener = true;
      button.addEventListener('click', function(e) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
          e.preventDefault();
        }
      });
    }
  });
}

// Setup dropdowns
function setupDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown-toggle');

  dropdowns.forEach(toggle => {
    if (!toggle.hasListener) {
      toggle.hasListener = true;
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = this.nextElementSibling;
        dropdown.classList.toggle('show');

        // Close other dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
          if (menu !== dropdown) {
            menu.classList.remove('show');
          }
        });
      });
    }
  });

  // Only add document click listener once
  if (!document.body.hasDropdownListener) {
    document.body.hasDropdownListener = true;
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }
}

// Clean up duplicate event listeners
document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
});
