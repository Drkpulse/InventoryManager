/**
 * Main JavaScript - Clean initialization without SPA complexity
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing page...');
  initializePage();
});

// Main initialization function
function initializePage() {
  setupUI();
  setupNotifications();
  setupDropdowns();
  setupForms();
  setupDeleteConfirmations();
  setupSidebar();
  updateActiveMenuItems();

  // Page-specific initialization
  initPageSpecific();
}

// Basic UI setup
function setupUI() {
  // Auto-hide flash messages after 5 seconds
  const alerts = document.querySelectorAll('.alert:not(.persistent), .flash-message:not(.persistent)');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (alert.parentNode) {
          alert.parentNode.removeChild(alert);
        }
      }, 500);
    }, 5000);
  });
}

// Setup notifications
function setupNotifications() {
  const notificationToggle = document.getElementById('notificationToggle');
  const notificationMenu = document.getElementById('notificationMenu');

  if (notificationToggle && notificationMenu) {
    notificationToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationMenu.classList.toggle('hidden');

      // Load notifications when opened
      if (!notificationMenu.classList.contains('hidden')) {
        loadNotifications();
      }
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!notificationToggle.contains(e.target) && !notificationMenu.contains(e.target)) {
        notificationMenu.classList.add('hidden');
      }
    });
  }
}

// Setup all dropdowns
function setupDropdowns() {
  // User dropdown
  const userDropdownToggle = document.getElementById('userDropdownToggle');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  if (userDropdownToggle && userDropdownMenu) {
    userDropdownToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!userDropdownToggle.contains(e.target) && !userDropdownMenu.contains(e.target)) {
        userDropdownMenu.classList.add('hidden');
      }
    });
  }

  // Generic dropdowns
  const dropdowns = document.querySelectorAll('.dropdown');
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (toggle && menu) {
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Close other dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove('show');
          }
        });

        menu.classList.toggle('show');
      });
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });
}

// Setup forms with basic validation
function setupForms() {
  const forms = document.querySelectorAll('form');

  forms.forEach(form => {
    // Skip if already processed
    if (form.hasFormHandler) return;
    form.hasFormHandler = true;

    // Add submit handler for validation
    form.addEventListener('submit', function(e) {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;

      // Clear previous errors
      form.querySelectorAll('.error-message').forEach(msg => msg.remove());
      form.querySelectorAll('.border-red-500').forEach(field => {
        field.classList.remove('border-red-500');
      });

      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          field.classList.add('border-red-500');

          const errorMsg = document.createElement('div');
          errorMsg.className = 'error-message text-red-500 text-sm mt-1';
          errorMsg.textContent = 'This field is required';
          field.parentNode.insertBefore(errorMsg, field.nextSibling);
        }
      });

      if (!isValid) {
        e.preventDefault();
        const firstError = form.querySelector('.border-red-500');
        if (firstError) {
          firstError.focus();
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        // Show loading state on submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (submitBtn.textContent || 'Processing...');
        }
      }
    });
  });
}

// Setup delete confirmations
function setupDeleteConfirmations() {
  // Delete buttons with confirmation
  document.querySelectorAll('[onclick*="confirmDelete"], .delete-btn').forEach(button => {
    if (button.hasDeleteHandler) return;
    button.hasDeleteHandler = true;

    button.addEventListener('click', function(e) {
      e.preventDefault();

      const confirmMessage = this.getAttribute('data-confirm') ||
                           'Are you sure you want to delete this item? This action cannot be undone.';

      if (confirm(confirmMessage)) {
        // If it's a form button, submit the form
        const form = this.closest('form');
        if (form) {
          form.submit();
        }
        // If it has an onclick attribute, evaluate it
        else if (this.getAttribute('onclick')) {
          eval(this.getAttribute('onclick'));
        }
      }
    });
  });
}

// Setup sidebar
function setupSidebar() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const appContainer = document.querySelector('.app-container') || document.body;

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      appContainer.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebarCollapsed',
        appContainer.classList.contains('sidebar-collapsed') ? 'true' : 'false');
    });

    // Restore sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      appContainer.classList.add('sidebar-collapsed');
    }
  }

  // Sidebar dropdowns
  const navItems = document.querySelectorAll('.nav-item.has-dropdown');
  navItems.forEach(item => {
    const link = item.querySelector('.nav-link');
    if (link && !link.hasDropdownHandler) {
      link.hasDropdownHandler = true;
      link.addEventListener('click', function(e) {
        e.preventDefault();
        item.classList.toggle('open');
      });
    }
  });
}

// Update active menu items based on current path
function updateActiveMenuItems() {
  const currentPath = window.location.pathname;

  // Remove active class from all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Add active class to matching links
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');

    if (href === currentPath) {
      link.classList.add('active');
    }
    // Handle section matching
    else if (href !== '/' && currentPath.startsWith(href)) {
      link.classList.add('active');
    }
    // Special case for dashboard
    else if ((currentPath === '/' || currentPath === '/dashboard') &&
             (href === '/' || href === '/dashboard')) {
      link.classList.add('active');
    }
  });
}

// Load notifications
function loadNotifications() {
  fetch('/api/notifications')
    .then(response => response.json())
    .then(data => {
      const notificationList = document.getElementById('notificationList');
      const notificationCount = document.getElementById('notificationCount');

      if (data.success && data.notifications) {
        // Update count
        if (data.notifications.length > 0) {
          notificationCount.textContent = data.notifications.length;
          notificationCount.style.display = 'inline';
        } else {
          notificationCount.style.display = 'none';
        }

        // Update list
        if (data.notifications.length === 0) {
          notificationList.innerHTML = '<div class="px-5 py-4 text-gray-500 dark:text-gray-300 text-center">No new notifications</div>';
        } else {
          notificationList.innerHTML = data.notifications.map(notification => `
            <div class="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
              <i class="fas fa-info-circle text-blue-500 dark:text-blue-300 mt-1"></i>
              <div>
                <div class="text-sm text-gray-900 dark:text-white font-medium">${notification.title}</div>
                <div class="text-xs text-gray-500 dark:text-gray-300">${notification.time}</div>
              </div>
            </div>
          `).join('');
        }
      }
    })
    .catch(error => {
      console.error('Error loading notifications:', error);
      document.getElementById('notificationList').innerHTML =
        '<div class="px-5 py-4 text-red-500 text-center">Error loading notifications</div>';
    });
}

// Page-specific initialization
function initPageSpecific() {
  const path = window.location.pathname;

  // Employee page specific
  if (path.includes('/employees/') && !path.includes('/edit')) {
    initEmployeePage();
  }

  // Items page specific
  if (path.includes('/items/') && !path.includes('/edit')) {
    initItemsPage();
  }

  // Software page specific
  if (path.includes('/software/')) {
    initSoftwarePage();
  }

  // Dashboard specific
  if (path === '/' || path === '/dashboard') {
    initDashboard();
  }
}

// Employee page initialization
function initEmployeePage() {
  // Setup assign asset modal
  const assignAssetBtn = document.getElementById('openAssignAssetModal');
  const assignAssetModal = document.getElementById('assignAssetModal');
  const closeAssignAssetBtn = document.getElementById('closeAssignAssetModal');

  if (assignAssetBtn && assignAssetModal) {
    assignAssetBtn.addEventListener('click', function() {
      assignAssetModal.style.display = 'flex';
      loadAvailableAssets();
    });
  }

  if (closeAssignAssetBtn && assignAssetModal) {
    closeAssignAssetBtn.addEventListener('click', function() {
      assignAssetModal.style.display = 'none';
    });
  }

  // Setup delete employee modal
  const deleteEmployeeBtn = document.getElementById('deleteEmployeeBtn');
  const deleteEmployeeModal = document.getElementById('deleteEmployeeModal');

  if (deleteEmployeeBtn && deleteEmployeeModal) {
    deleteEmployeeBtn.addEventListener('click', function() {
      checkEmployeeAssignments();
    });
  }
}

// Items page initialization
function initItemsPage() {
  // Any items-specific functionality
  console.log('Items page initialized');
}

// Software page initialization
function initSoftwarePage() {
  // Any software-specific functionality
  console.log('Software page initialized');
}

// Dashboard initialization
function initDashboard() {
  // Load dashboard-specific script if it exists
  if (typeof initializeDashboard === 'function') {
    initializeDashboard();
  }
}

// Helper functions for employee page
function loadAvailableAssets() {
  const assignAssetList = document.getElementById('assignAssetList');
  if (!assignAssetList) return;

  assignAssetList.innerHTML = '<div class="text-center py-4">Loading assets...</div>';

  fetch('/items/api/unassigned')
    .then(response => response.json())
    .then(data => {
      if (data.items && data.items.length > 0) {
        assignAssetList.innerHTML = data.items.map(item => `
          <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-3">
            <div>
              <div class="font-medium">${item.name}</div>
              <div class="text-sm text-gray-500">${item.cep_brc || 'No CEP'}</div>
            </div>
            <button onclick="assignAsset('${item.id}', '${item.cep_brc}')"
                    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
              Assign
            </button>
          </div>
        `).join('');
      } else {
        assignAssetList.innerHTML = '<div class="text-center py-4 text-gray-500">No available assets</div>';
      }
    })
    .catch(error => {
      console.error('Error loading assets:', error);
      assignAssetList.innerHTML = '<div class="text-center py-4 text-red-500">Error loading assets</div>';
    });
}

function checkEmployeeAssignments() {
  const employeeId = window.location.pathname.split('/')[2];
  const deleteEmployeeModal = document.getElementById('deleteEmployeeModal');

  fetch(`/employees/${employeeId}/delete`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    const noAssignedItems = document.getElementById('noAssignedItems');
    const hasAssignedItems = document.getElementById('hasAssignedItems');

    if (data.hasAssignedItems) {
      hasAssignedItems.style.display = 'block';
      noAssignedItems.style.display = 'none';
    } else {
      hasAssignedItems.style.display = 'none';
      noAssignedItems.style.display = 'block';
    }

    deleteEmployeeModal.style.display = 'flex';
  })
  .catch(error => {
    console.error('Error checking assignments:', error);
    alert('Error checking employee assignments');
  });
}

// Global helper functions
window.assignAsset = function(assetId, cepBrc) {
  const employeeId = window.location.pathname.split('/')[2];

  fetch(`/items/${assetId}/${cepBrc}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assigned_to: employeeId,
      date_assigned: new Date().toISOString().split('T')[0]
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      window.location.reload();
    } else {
      alert('Failed to assign asset: ' + (data.error || 'Unknown error'));
    }
  })
  .catch(error => {
    console.error('Error assigning asset:', error);
    alert('Failed to assign asset');
  });
};

window.confirmDelete = function(id, name, type = 'item') {
  const message = `Are you sure you want to delete "${name}"? This action cannot be undone.`;

  if (confirm(message)) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/${type}s/${id}/delete`;

    // Add CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]');
    if (csrfToken) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_token';
      input.value = csrfToken.getAttribute('content');
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }
};

// Expose main function globally for any page-specific needs
window.initializePage = initializePage;
