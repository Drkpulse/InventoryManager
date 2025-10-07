/**
 * Simple SPA Navigation - Fast content loading
 */
(function() {
  'use strict';

  if (window.spaNavigationInitialized) return;
  window.spaNavigationInitialized = true;
  window.spaNavigationActive = true;



  // Simple state management
  let isLoading = false;
  const mainContent = document.getElementById('mainContent');

  if (!mainContent) {
    console.warn('No mainContent found, SPA disabled');
    return;
  }

  // Create skeleton loading for main content
  function createSkeletonLoading() {
    const skeleton = document.createElement('div');
    skeleton.id = 'skeletonLoading';
    skeleton.className = 'skeleton-loading';
    skeleton.innerHTML = `
      <div class="skeleton-container">
        <!-- Header skeleton -->
        <div class="skeleton-header">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line skeleton-subtitle"></div>
        </div>

        <!-- Content skeleton -->
        <div class="skeleton-content">
          <div class="skeleton-card">
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text short"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text short"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text short"></div>
          </div>
        </div>
      </div>
    `;
    return skeleton;
  }

  // Create loading overlay for full-page transitions (fallback)
  function createTransitionOverlay() {
    if (document.getElementById('pageTransitionOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pageTransitionOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%);
      backdrop-filter: blur(12px) saturate(120%);
      z-index: 9998;
      opacity: 0;
      pointer-events: none;
      transition: opacity ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;

    // Add dark mode support
    if (document.body.getAttribute('data-theme') === 'dark') {
      overlay.style.background = 'linear-gradient(135deg, rgba(17,24,39,0.95) 0%, rgba(31,41,55,0.98) 100%)';
    }

    // Add loading content
    overlay.innerHTML = `
      <div class="loading-content" style="text-align: center; color: var(--text-primary, #374151);">
        <div class="loading-spinner" style="
          width: 32px;
          height: 32px;
          border: 2px solid rgba(99, 102, 241, 0.2);
          border-top-color: rgb(99, 102, 241);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p style="font-size: 14px; font-weight: 500; opacity: 0.8; margin: 0;">Loading...</p>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    document.body.appendChild(overlay);
  }

  // Show skeleton loading in main content
    function showSkeletonLoading() {
    if (!mainContent) return;

    const existing = mainContent.querySelector('#skeletonLoading');
    if (existing) {
      existing.remove();
    }

    const skeleton = createSkeletonLoading();
    mainContent.innerHTML = '';
    mainContent.appendChild(skeleton);

    // No loading transitions - just show content immediately
    mainContent.style.cssText = '';
    mainContent.classList.add('skeleton-loading');
  }

  // Hide skeleton loading
  function hideSkeletonLoading() {
    if (!mainContent) return;

    // Remove skeleton if present
    const skeleton = document.getElementById('skeletonLoading');
    if (skeleton) {
      skeleton.remove();
    }

    // Remove skeleton class and clear ALL styles - no animations
    mainContent.classList.remove('skeleton-loading');
    mainContent.style.cssText = '';

    // Clear transitioning state
    isTransitioning = false;
  }

  // Show transition animation (fallback)
  function showTransition() {
    if (isTransitioning) return;
    isTransitioning = true;

    createTransitionOverlay();
    const overlay = document.getElementById('pageTransitionOverlay');

    // Smooth fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'all';
    });
  }

  // Hide transition animation (fallback)
  function hideTransition() {
    const overlay = document.getElementById('pageTransitionOverlay');
    if (!overlay) {
      isTransitioning = false;
      return;
    }

    // Smooth fade out
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      isTransitioning = false;
    }, ANIMATION_DURATION);
  }

  // Load content via AJAX with skeleton loading
  async function loadContent(url) {
    console.log('📥 Loading content:', url);

    if (!mainContent) {
      console.log('❌ No main content container, falling back to full page load');
      window.location.href = url;
      return;
    }

    const now = Date.now();

    // Throttle rapid requests
    if (now - lastNavigationTime < NAVIGATION_THROTTLE) {
      console.log('🚫 Request throttled, too soon after last navigation');
      return;
    }

    if (isTransitioning) {
      console.log('🚫 Already transitioning, ignoring request');
      return;
    }

    // Skip if same URL
    if (url === window.location.href) {
      console.log('🚫 Same URL, skipping');
      return;
    }

    lastNavigationTime = now;
    console.log('✅ Proceeding with AJAX navigation');

    try {
      // Show skeleton loading in main content
      showSkeletonLoading();

      // Fetch new content with explicit AJAX headers
      console.log('🌐 Making AJAX request to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('📡 Response received - Status:', response.status, 'Content-Type:', response.headers.get('Content-Type'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';

      // Try to parse as JSON first
      let data;
      try {
        if (contentType.includes('application/json')) {
          console.log('✅ Received JSON response, parsing...');
          data = await response.json();
          console.log('📦 Parsed JSON data keys:', Object.keys(data));
        } else {
          throw new Error('Not JSON response');
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse JSON or not JSON response, falling back to full page load');
        console.log('Content-Type:', contentType);
        isTransitioning = false;
        window.location.href = url;
        return;
      }

      // Handle parsed JSON data
      if (data.redirect) {
        console.log('🔄 Redirect requested to:', data.redirect);
        isTransitioning = false;
        window.location.href = data.redirect;
        return;
      }

      if (data.content) {
        console.log('✅ Loading content into main container (SPA mode)');

        // Clear loading state immediately
        isTransitioning = false;
        hideSkeletonLoading();

        // Replace content without any animations
        mainContent.innerHTML = data.content;

        // Update page title
        if (data.title) {
          document.title = data.title + ' | IT Asset Manager';
        }

        // Update URL
        window.history.pushState({ path: url }, data.title || '', url);

        // Ensure completely clean state - no animations
        if (mainContent) {
          mainContent.style.cssText = ''; // Clear all inline styles
          mainContent.classList.remove('fade-in', 'fade-out', 'skeleton-loading');
        }

        // Initialize page components immediately without delay
        initializePageComponents();

        console.log('✅ SPA navigation completed successfully');
      } else {
        console.log('❌ No content in JSON response, falling back to full page load');
        isTransitioning = false;
        window.location.href = url;
        return;
      }

    } catch (error) {
      console.error('Content loading failed:', error);
      isTransitioning = false;

      // Reset main content state
      mainContent.style.opacity = '1';
      mainContent.style.transform = 'translateY(0)';

      // Fallback to full page load
      showTransition();
      setTimeout(() => {
        window.location.href = url;
      }, 150);
    }
  }

  // Enhanced navigation with smooth transitions
  function handleNavigation(url, skipTransition = false) {
    if (mainContent && !skipTransition) {
      // Use AJAX loading for main content updates
      loadContent(url);
    } else {
      // Fallback to full page load with transition
      const now = Date.now();

      if (now - lastNavigationTime < NAVIGATION_THROTTLE) {
        return;
      }

      if (isTransitioning) return;

      if (url === window.location.href) {
        return;
      }

      lastNavigationTime = now;

      if (!skipTransition) {
        showTransition();
      }

      setTimeout(() => {
        window.location.href = url;
      }, skipTransition ? 0 : 150);
    }
  }

  // Enhanced form submission with smooth transitions
  function handleFormSubmission(form) {
    if (isTransitioning) return false;

    // Check if form should use smooth transition
    if (form.hasAttribute('data-no-transition') ||
        form.method.toLowerCase() === 'get') {
      return true; // Allow normal submission
    }

    showTransition();

    // Add slight delay for animation, then submit
    setTimeout(() => {
      form.submit();
    }, 150);

    return false; // Prevent immediate submission
  }

  // Intercept link clicks for smooth transitions - CAPTURE PHASE to prevent conflicts
  document.addEventListener('click', function(event) {
    const link = event.target.closest('a');

    if (!link ||
        !link.href ||
        link.href.startsWith('javascript:') ||
        link.href.startsWith('#') ||
        link.href.startsWith('mailto:') ||
        link.href.startsWith('tel:') ||
        link.hasAttribute('target') ||
        link.hasAttribute('data-no-transition') ||
        link.href === window.location.href ||
        event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    // Only handle internal links
    if (!link.href.startsWith(window.location.origin)) {
      return;
    }

    // Skip if link is in a form (let form handle submission)
    if (link.closest('form')) {
      return;
    }

    // Skip dropdown navigation (has-dropdown class or parent)
    if (link.closest('.nav-item.has-dropdown') || link.classList.contains('dropdown-toggle')) {
      return;
    }

    // Skip user dropdown and other UI elements
    if (link.closest('#userDropdownMenu') ||
        link.closest('.dropdown-menu') ||
        link.id === 'userDropdownToggle') {
      return;
    }

    // STOP ALL OTHER HANDLERS - This is critical!
    event.preventDefault();
    event.stopImmediatePropagation();

    console.log('🔗 SPA Navigation intercepted:', link.href);

    // Navigate immediately without visual effects
    handleNavigation(link.href);
  }, true); // Use CAPTURE phase to intercept before other handlers

  // Intercept form submissions for smooth transitions - CAPTURE PHASE
  document.addEventListener('submit', function(event) {
    const form = event.target;

    // Skip if form explicitly opts out or is a GET form
    if (form.hasAttribute('data-no-transition') ||
        form.method.toLowerCase() === 'get' ||
        form.id === 'loginForm') {
      return;
    }

    // Stop other handlers from interfering
    event.preventDefault();
    event.stopImmediatePropagation();

    const shouldSubmit = handleFormSubmission(form);

    if (shouldSubmit) {
      // Create a new form element and submit it to avoid conflicts
      const newForm = form.cloneNode(true);
      newForm.style.display = 'none';
      document.body.appendChild(newForm);
      newForm.submit();
    }
  }, true); // Use CAPTURE phase

  // Initialize page components after content load
  function initializePageComponents() {
    // Ensure we're no longer in transitioning state
    isTransitioning = false;

    // Re-run main.js initialization
    if (typeof window.initializePage === 'function') {
      try {
        window.initializePage();
      } catch (error) {
        console.warn('Error running page initialization:', error);
      }
    }

    // Dispatch content loaded event
    document.dispatchEvent(new CustomEvent('content-loaded'));

    // Initialize any page-specific scripts
    const scripts = mainContent.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.src) {
        // For external scripts, create new script element
        const newScript = document.createElement('script');
        newScript.src = script.src;
        newScript.async = false; // Preserve execution order
        document.head.appendChild(newScript);
      } else if (script.textContent && script.textContent.trim()) {
        // For inline scripts, execute them
        try {
          // Create a new script element to properly execute
          const newScript = document.createElement('script');
          newScript.textContent = script.textContent;
          document.head.appendChild(newScript);
          document.head.removeChild(newScript);
        } catch (error) {
          console.warn('Error executing inline script:', error);
        }
      }
    });
  }

  // Handle browser navigation (back/forward)
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.path) {
      loadContent(event.state.path);
    } else {
      // Fallback to full page reload for complex navigation
      showTransition();
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  });

  // Handle page load completion
  window.addEventListener('load', function() {
    hideTransition();
    hideSkeletonLoading();
  });

  // Handle page unload to show transition
  window.addEventListener('beforeunload', function() {
    if (!isTransitioning) {
      showSkeletonLoading();
    }
  });

  // Expose functions globally for manual control
  window.smoothTransition = {
    show: showTransition,
    hide: hideTransition,
    showSkeleton: showSkeletonLoading,
    hideSkeleton: hideSkeletonLoading,
    navigate: handleNavigation,
    loadContent: loadContent,
    isTransitioning: () => isTransitioning
  };

  // Initialize and cleanup on page load - DELAY to let other scripts finish
  document.addEventListener('DOMContentLoaded', function() {
    // Delay initialization to ensure we're the last one to set up
    setTimeout(() => {
      console.log('🚀 SPA Navigation Controller initializing...');

      // Ensure clean state on page load
      isTransitioning = false;

      // Clean up any existing overlays/skeletons
      const existingOverlay = document.getElementById('pageTransitionOverlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      const existingSkeleton = document.getElementById('skeletonLoading');
      if (existingSkeleton) {
        existingSkeleton.remove();
      }

      // Reset main content styles
      if (mainContent) {
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'translateY(0)';
        mainContent.style.transition = '';
      }

      // Set initial navigation state
      if (window.location.pathname !== '/') {
        window.history.replaceState({ path: window.location.pathname }, '', window.location.pathname);
      }

      console.log('✅ SPA Navigation Controller initialized');
    }, 100); // Small delay to let other scripts finish
  });

  // Simple visibility change cleanup - no animations
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      // Just ensure clean state without any delays or animations
      if (mainContent) {
        mainContent.style.cssText = '';
        mainContent.classList.remove('fade-in', 'fade-out', 'skeleton-loading');
      }
      isTransitioning = false;
    }
  });

  // Simple content change observer - no animations
  if (mainContent) {
    const observer = new MutationObserver(function(mutations) {
      // Just ensure clean state without any animations
      if (mainContent) {
        mainContent.style.cssText = ''; // Clear all inline styles
        mainContent.classList.remove('fade-in', 'fade-out', 'skeleton-loading');
      }
      isTransitioning = false;
    });

    observer.observe(mainContent, {
      childList: true,
      subtree: false
    });
  }

  // Navigation function for external use
  function navigateToUrl(url) {
    handleNavigation(url);
  }

  // Expose controller globally for other scripts
  window.spaController = {
    navigateToUrl: navigateToUrl
  };

})();
