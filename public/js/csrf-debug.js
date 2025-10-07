/**
 * CSRF Debug Helper
 * Provides utilities to debug CSRF token issues
 */

// Function to check if CSRF token is available
function checkCSRFToken() {
  const csrfToken = document.querySelector('meta[name="csrf-token"]');
  if (csrfToken) {
    console.log('✅ CSRF token found:', csrfToken.getAttribute('content'));
    return true;
  } else {
    console.error('❌ CSRF token not found! Check if csrf-protection.ejs is included.');
    return false;
  }
}

// Function to create headers with CSRF token
function createCSRFHeaders(additionalHeaders = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]');
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
    ...additionalHeaders
  };

  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken.getAttribute('content');
    console.log('🔒 CSRF token added to headers');
  } else {
    console.warn('⚠️ CSRF token not available for headers');
  }

  return headers;
}

// Function to make CSRF-protected fetch requests
function csrfFetch(url, options = {}) {
  const headers = createCSRFHeaders(options.headers);

  return fetch(url, {
    ...options,
    headers: headers
  }).then(response => {
    // Log response details for debugging
    console.log(`🔍 CSRF Request to ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  });
}

// Debug function to test CSRF token
function debugCSRFToken() {
  console.group('🔍 CSRF Debug Information');

  // Check if token exists
  checkCSRFToken();

  // Check meta tag content
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    console.log('Meta tag content:', metaTag.getAttribute('content'));
    console.log('Meta tag length:', metaTag.getAttribute('content')?.length);
  }

  // Check if page has proper CSRF protection include
  const head = document.head.innerHTML;
  if (head.includes('csrf-token')) {
    console.log('✅ CSRF meta tag detected in page head');
  } else {
    console.error('❌ CSRF meta tag not found in page head');
  }

  console.groupEnd();
}

// Export functions for global use
window.csrfDebug = {
  check: checkCSRFToken,
  createHeaders: createCSRFHeaders,
  fetch: csrfFetch,
  debug: debugCSRFToken
};

// Auto-run debug on page load if in development
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
    console.log('🔧 CSRF Debug mode active - run csrfDebug.debug() for detailed info');
  }
});
