/**
 * Event Handlers - Centralized event management for CSP compliance
 * This file contains all event handlers that were previously inline
 */

// Define functions immediately to ensure they're available
window.acceptAllCookies = function() {
  console.log('✅ acceptAllCookies function called');

  // Set localStorage as the original code expects
  localStorage.setItem('cookieConsent', 'true');
  console.log('✅ localStorage.cookieConsent set to true');

  // Also set cookies for backend
  document.cookie = "cookie_consent=accepted; path=/; max-age=31536000";
  document.cookie = "analytics_consent=true; path=/; max-age=31536000";
  document.cookie = "marketing_consent=true; path=/; max-age=31536000";
  console.log('✅ Cookies set for backend');

  hideCookieBanner();
  console.log('✅ hideCookieBanner called');
};

window.rejectCookies = function() {
  console.log('Rejecting non-essential cookies...');
  // Set localStorage as the original code expects
  localStorage.setItem('cookieConsent', 'true');

  // Set cookies for backend
  document.cookie = "cookie_consent=rejected; path=/; max-age=31536000";
  document.cookie = "analytics_consent=false; path=/; max-age=31536000";
  document.cookie = "marketing_consent=false; path=/; max-age=31536000";

  hideCookieBanner();
};

window.showCookieManager = function() {
  const banner = document.getElementById('cookieConsentPopup');
  const manager = document.getElementById('cookieManagerModal');

  console.log('showCookieManager called:', { banner, manager });

  // Hide the banner and show the manager
  if (banner) {
    banner.classList.add('hidden');
    banner.style.display = 'none';
  }
  if (manager) {
    manager.classList.remove('hidden');
    manager.style.display = 'flex';
  }
};

window.hideCookieManager = function() {
  const manager = document.getElementById('cookieManagerModal');
  const banner = document.getElementById('cookieConsentPopup');

  console.log('hideCookieManager called:', { manager, banner });

  // Hide the manager
  if (manager) {
    manager.classList.add('hidden');
    manager.style.display = 'none';
  }

  // Don't show the banner again if consent was already given
  if (!localStorage.getItem('cookieConsent') && banner) {
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  }
};

function hideCookieBanner() {
  // Hide the cookie consent popup using both methods for reliability
  const banner = document.getElementById('cookieConsentPopup');
  console.log('🔍 hideCookieBanner called. Banner element:', banner);

  if (banner) {
    console.log('🔍 Banner before hiding - classes:', banner.className);
    console.log('🔍 Banner before hiding - style.display:', banner.style.display);

    banner.classList.add('hidden');
    banner.style.display = 'none';

    console.log('✅ Banner hidden - classes:', banner.className);
    console.log('✅ Banner hidden - style.display:', banner.style.display);
  } else {
    console.error('❌ Cookie banner element not found!');
  }
}

// Execute immediately when script loads
(function() {
  console.log('Event handlers script loaded - functions defined globally');

  // Try to attach immediately and also on DOM ready
  attachCookieEventListeners();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCookieEventListeners);
  } else {
    // DOM is already ready
    setTimeout(attachCookieEventListeners, 100);
  }
})();

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - re-attaching event listeners');

  // Re-attach event listeners to ensure they're working
  setTimeout(attachCookieEventListeners, 500);

  function attachCookieEventListeners() {
    console.log('🔄 Attaching cookie event listeners...');

    let attached = 0;
    let total = 0;

    // Accept All Cookies button
    const acceptBtn = document.getElementById('acceptAllCookiesBtn');
    total++;
    if (acceptBtn) {
      // Remove any existing listeners to avoid duplicates
      acceptBtn.replaceWith(acceptBtn.cloneNode(true));
      const newAcceptBtn = document.getElementById('acceptAllCookiesBtn');

      newAcceptBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Accept button clicked via event listener');
        window.acceptAllCookies();
      });

      // Add backup onclick handler for fallback
      newAcceptBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Accept button clicked via onclick fallback');
        window.acceptAllCookies();
      };

      attached++;
      console.log('✅ Accept button listener attached (with fallback)');
    } else {
      console.warn('❌ Accept button not found (ID: acceptAllCookiesBtn)');
    }

    // Reject Cookies button
    const rejectBtn = document.getElementById('rejectCookiesBtn');
    total++;
    if (rejectBtn) {
      rejectBtn.replaceWith(rejectBtn.cloneNode(true));
      const newRejectBtn = document.getElementById('rejectCookiesBtn');

      newRejectBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Reject button clicked via event listener');
        window.rejectCookies();
      });

      newRejectBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Reject button clicked via onclick fallback');
        window.rejectCookies();
      };

      attached++;
      console.log('✅ Reject button listener attached (with fallback)');
    } else {
      console.warn('❌ Reject button not found (ID: rejectCookiesBtn)');
    }

    // Show Cookie Manager button
    const managerBtn = document.getElementById('showCookieManagerBtn');
    total++;
    if (managerBtn) {
      managerBtn.replaceWith(managerBtn.cloneNode(true));
      const newManagerBtn = document.getElementById('showCookieManagerBtn');

      newManagerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Cookie manager button clicked via event listener');
        window.showCookieManager();
      });

      newManagerBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Cookie manager button clicked via onclick fallback');
        window.showCookieManager();
      };

      attached++;
      console.log('✅ Cookie manager button listener attached (with fallback)');
    } else {
      console.warn('❌ Cookie manager button not found (ID: showCookieManagerBtn)');
    }

    // Hide Cookie Manager buttons (there are two)
    const closeBtns = ['closeCookieManagerBtn', 'closeCookieManagerBtn2'];
    closeBtns.forEach(btnId => {
      const closeBtn = document.getElementById(btnId);
      total++;
      if (closeBtn) {
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        const newCloseBtn = document.getElementById(btnId);

        newCloseBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ Close cookie manager button clicked via event listener');
          window.hideCookieManager();
        });

        newCloseBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ Close cookie manager button clicked via onclick fallback');
          window.hideCookieManager();
        };

        attached++;
        console.log(`✅ ${btnId} listener attached (with fallback)`);
      }
    });

    // Clear All Cookies button
    const clearBtn = document.getElementById('clearAllCookiesBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Clear cookies button clicked');
        window.clearAllCookies();
      });
      console.log('✅ Clear cookies button listener attached');
    }

    // Export Cookie Data button
    const exportBtn = document.getElementById('exportCookieDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Export data button clicked');
        window.exportCookieData();
      });
      console.log('✅ Export data button listener attached');
    }

    // Update preferences checkboxes
    const checkboxes = ['performanceCookies', 'preferenceCookies'];
    checkboxes.forEach(checkboxId => {
      const checkbox = document.getElementById(checkboxId);
      if (checkbox) {
        checkbox.addEventListener('change', function(e) {
          console.log(`${checkboxId} changed:`, e.target.checked);
          window.updateCookiePreferences();
        });
        console.log(`✅ ${checkboxId} listener attached`);
      }
    });

    console.log(`📊 Event listeners attached: ${attached}/${total} buttons found`);

    // Global test functions for debugging
    window.testCookieButtons = function() {
      console.log('🧪 Testing cookie buttons...');
      console.log('Accept button:', document.getElementById('acceptAllCookiesBtn'));
      console.log('Reject button:', document.getElementById('rejectCookiesBtn'));
      console.log('Manager button:', document.getElementById('showCookieManagerBtn'));
      console.log('Popup element:', document.getElementById('cookieConsentPopup'));
      console.log('Manager element:', document.getElementById('cookieManagerModal'));
    };

    return attached;
  }

  window.updateCookiePreferences = function() {
    console.log('Updating cookie preferences...');

    // Get checkbox states
    const performance = document.getElementById('performanceCookies')?.checked || false;
    const preference = document.getElementById('preferenceCookies')?.checked || false;

    // Set localStorage as the original code expects
    localStorage.setItem('cookieConsent', 'true');

    // Set individual cookie preferences
    document.cookie = `cookie_consent=customized; path=/; max-age=31536000`;
    document.cookie = `analytics_consent=${performance}; path=/; max-age=31536000`;
    document.cookie = `preference_consent=${preference}; path=/; max-age=31536000`;

    hideCookieManager();
  };

  window.clearAllCookies = function() {
    console.log('Clearing all cookies...');

    // Clear localStorage
    localStorage.removeItem('cookieConsent');

    // Clear all cookies
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    location.reload();
  };

  window.exportCookieData = function() {
    const cookieData = {
      timestamp: new Date().toISOString(),
      localStorage: {
        cookieConsent: localStorage.getItem('cookieConsent')
      },
      cookies: document.cookie.split(';').map(c => {
        const [name, value] = c.trim().split('=');
        return { name, value: value || '' };
      })
    };

    const dataStr = JSON.stringify(cookieData, null, 2);
    const dataBlob = new Blob([dataStr], {type:'application/json'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `cookie-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  function hideCookieBanner() {
    // Hide the cookie consent popup using both methods for reliability
    const banner = document.getElementById('cookieConsentPopup');
    if (banner) {
      banner.classList.add('hidden');
      banner.style.display = 'none';
    }
  }

  // Dashboard Functions
  window.refreshInsights = function() {
    console.log('Refreshing insights...');
    // Add your refresh logic here
    // Get CSRF token
    const csrfToken = document.querySelector('meta[name="csrf-token"]');
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    // Add CSRF token to headers
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken.getAttribute('content');
    }

    fetch('/api/insights/refresh', {
      method: 'POST',
      headers: headers
    })
    .then(response => response.json())
    .then(data => {
      console.log('Insights refreshed:', data);
      // Update UI with new data
    })
    .catch(error => {
      console.error('Error refreshing insights:', error);
    });
  };

  // Privacy Policy and Terms Functions
  window.showPrivacyPolicy = function() {
    // Create and show privacy policy modal
    showModal('Privacy Policy', getPrivacyPolicyContent());
  };

  window.showTermsOfService = function() {
    // Create and show terms of service modal
    showModal('Terms of Service', getTermsOfServiceContent());
  };

  // Modal helper functions
  window.closeDeleteModal = function() {
    const modal = document.querySelector('.delete-modal, [id*="deleteModal"], [class*="delete-modal"]');
    if (modal) {
      modal.style.display = 'none';
      modal.remove();
    }
  };

  // Asset report functions
  window.generateFullAssetReport = function() {
    console.log('Generating full asset report...');
    // Add report generation logic
    const employeeId = document.querySelector('[data-employee-id]')?.dataset.employeeId;
    if (employeeId) {
      window.open(`/employees/${employeeId}/report`, '_blank');
    }
  };

  // Export functions
  window.exportHistory = function() {
    console.log('Exporting history...');
    // Add export logic
    const currentPath = window.location.pathname;
    window.open(currentPath + '/export', '_blank');
  };

  window.printHistory = function() {
    console.log('Printing history...');
    window.print();
  };

  // Search functions
  window.searchSuggestion = function(term) {
    const searchInput = document.querySelector('input[name="q"], input[type="search"]');
    if (searchInput) {
      searchInput.value = term;
      searchInput.form.submit();
    }
  };

  window.toggleAdvancedFilters = function() {
    const filtersDiv = document.querySelector('.advanced-filters, [id*="advanced"], [class*="advanced-filter"]');
    if (filtersDiv) {
      filtersDiv.style.display = filtersDiv.style.display === 'none' ? 'block' : 'none';
    }
  };

  // Duplicate modal functions
  window.showDuplicateModal = function() {
    const modal = document.getElementById('duplicateModal');
    if (modal) {
      modal.style.display = 'block';
    }
  };

  // Utility functions
  function showModal(title, content) {
    const modalHtml = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="this.remove()">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">${title}</h2>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="prose dark:prose-invert">
            ${content}
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function getPrivacyPolicyContent() {
    return `
      <h3>Privacy Policy</h3>
      <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.</p>
      <h4>Information We Collect</h4>
      <ul>
        <li>Account information (name, email, role)</li>
        <li>Asset and inventory data</li>
        <li>Usage analytics (with consent)</li>
      </ul>
      <h4>How We Use Information</h4>
      <ul>
        <li>To provide and improve our services</li>
        <li>To maintain security and prevent fraud</li>
        <li>To communicate with users</li>
      </ul>
    `;
  }

  function getTermsOfServiceContent() {
    return `
      <h3>Terms of Service</h3>
      <p>By using this IT Asset Management system, you agree to the following terms:</p>
      <h4>Acceptable Use</h4>
      <ul>
        <li>Use the system only for legitimate business purposes</li>
        <li>Maintain the security of your account credentials</li>
        <li>Report any security issues promptly</li>
      </ul>
      <h4>Data Responsibility</h4>
      <ul>
        <li>Ensure accuracy of entered data</li>
        <li>Respect confidentiality of asset information</li>
        <li>Follow your organization's IT policies</li>
      </ul>
    `;
  }

  // CSS fallback handler for stylesheets
  window.handleStylesheetError = function(element) {
    console.warn('Stylesheet failed to load:', element.href);
    element.onerror = null; // Prevent infinite loops
    element.href = '/css/styles.css'; // Fallback stylesheet
  };

  // Debug function to check cookie popup state
  window.debugCookiePopup = function() {
    const banner = document.getElementById('cookieConsentPopup');
    const manager = document.getElementById('cookieManagerModal');

    console.log('Cookie Popup Debug Info:');
    console.log('Banner element:', banner);
    console.log('Banner classes:', banner?.className);
    console.log('Banner display style:', banner?.style.display);
    console.log('Manager element:', manager);
    console.log('Manager classes:', manager?.className);
    console.log('Manager display style:', manager?.style.display);
    console.log('LocalStorage cookieConsent:', localStorage.getItem('cookieConsent'));
  };

  // Auto-attach event listeners to existing elements
  attachEventListeners();

  function attachEventListeners() {
    // Attach event listeners to existing elements to replace inline handlers

    // Cookie buttons - use more specific selectors and don't remove onclick (for fallback)
    document.querySelectorAll('[onclick*="acceptAllCookies"]').forEach(btn => {
      // Keep onclick as fallback but add proper event listener
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        acceptAllCookies();
      }, true);
    });

    document.querySelectorAll('[onclick*="rejectCookies"]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        rejectCookies();
      }, true);
    });

    document.querySelectorAll('[onclick*="showCookieManager"]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showCookieManager();
      }, true);
    });

    document.querySelectorAll('[onclick*="hideCookieManager"]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        hideCookieManager();
      }, true);
    });

    // Dashboard refresh button
    document.querySelectorAll('[onclick*="refreshInsights"]').forEach(btn => {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', refreshInsights);
    });

    // Modal close buttons
    document.querySelectorAll('[onclick*="closeDeleteModal"]').forEach(btn => {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', closeDeleteModal);
    });

    // Privacy and terms links
    document.querySelectorAll('[onclick*="showPrivacyPolicy"]').forEach(link => {
      link.removeAttribute('onclick');
      link.addEventListener('click', showPrivacyPolicy);
    });

    document.querySelectorAll('[onclick*="showTermsOfService"]').forEach(link => {
      link.removeAttribute('onclick');
      link.addEventListener('click', showTermsOfService);
    });

    // Cookie preference checkboxes
    document.querySelectorAll('[onchange*="updateCookiePreferences"]').forEach(checkbox => {
      checkbox.addEventListener('change', function(e) {
        e.preventDefault();
        e.stopPropagation();
        updateCookiePreferences();
      }, true);
    });

    // Stylesheet error handlers
    document.querySelectorAll('link[rel="stylesheet"][onerror]').forEach(link => {
      const originalOnerror = link.getAttribute('onerror');
      link.removeAttribute('onerror');
      link.addEventListener('error', () => handleStylesheetError(link));
    });
  }
});
