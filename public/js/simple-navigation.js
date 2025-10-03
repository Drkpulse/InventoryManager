/**
 * Simple SPA Navigation - Fast and minimal
 */
(function() {
  'use strict';

  if (window.simpleNavInit) return;
  window.simpleNavInit = true;

  const mainContent = document.getElementById('mainContent');
  if (!mainContent) return;

  let isLoading = false;

  // Enhanced skeleton loading
  function createSkeleton() {
    const skeletonTypes = {
      header: `
        <div class="skeleton-header p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="skeleton-line h-8 w-8 rounded-full"></div>
              <div class="skeleton-line h-8 w-64"></div>
            </div>
            <div class="flex gap-2">
              <div class="skeleton-line h-10 w-32 rounded-lg"></div>
              <div class="skeleton-line h-10 w-28 rounded-lg"></div>
            </div>
          </div>
        </div>
      `,
      searchBar: `
        <div class="skeleton-search p-4">
          <div class="skeleton-line h-12 w-full rounded-lg mb-4"></div>
          <div class="skeleton-line h-10 w-48 rounded-lg"></div>
        </div>
      `,
      table: `
        <div class="skeleton-table">
          ${Array.from({length: 8}, (_, i) => `
            <div class="skeleton-row flex items-center p-4 border-b border-gray-100 dark:border-gray-800">
              <div class="skeleton-line h-10 w-10 rounded-full mr-4"></div>
              <div class="flex-1 space-y-2">
                <div class="skeleton-line h-5 w-full max-w-sm"></div>
                <div class="skeleton-line h-4 w-3/4 max-w-xs"></div>
              </div>
              <div class="skeleton-line h-8 w-20 rounded-lg"></div>
            </div>
          `).join('')}
        </div>
      `,
      cards: `
        <div class="skeleton-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          ${Array.from({length: 6}, (_, i) => `
            <div class="skeleton-card bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <div class="skeleton-line h-6 w-3/4 mb-3"></div>
              <div class="skeleton-line h-4 w-full mb-2"></div>
              <div class="skeleton-line h-4 w-5/6 mb-4"></div>
              <div class="flex justify-between items-center">
                <div class="skeleton-line h-5 w-24"></div>
                <div class="skeleton-line h-8 w-16 rounded-lg"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    };

    // Detect page type based on current URL
    const path = window.location.pathname;
    let pageType = 'table'; // default

    if (path === '/' || path === '/dashboard') {
      pageType = 'cards';
    } else if (path.includes('/items') || path.includes('/employees') || path.includes('/users')) {
      pageType = 'table';
    }

    return `
      <div class="skeleton-container animate-pulse">
        ${skeletonTypes.header}
        ${skeletonTypes.searchBar}
        ${skeletonTypes[pageType]}
      </div>
    `;
  }

  function showLoading() {
    if (isLoading) return;
    isLoading = true;

    // Show skeleton in main content
    mainContent.innerHTML = createSkeleton();

    // Show modern loading indicator
    const loader = document.createElement('div');
    loader.id = 'pageLoader';
    loader.className = 'fixed top-4 right-4 z-50';
    loader.innerHTML = `
      <div class="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 flex items-center gap-2">
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <span class="text-sm font-medium">Loading...</span>
      </div>
    `;
    document.body.appendChild(loader);
  }

  function hideLoading() {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.remove();
    isLoading = false;
  }

  // Fast content loading with proper initialization
  async function loadPage(url) {
    if (isLoading) return;

    showLoading();

    try {
      console.log('🚀 Loading page:', url);

      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Network error');

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid JSON response from server');
      }

      if (data.content) {
        console.log('📝 Content received, updating DOM...');

        // Update content
        mainContent.innerHTML = data.content;

        // Update page title
        if (data.title) {
          document.title = data.title + ' | IT Asset Manager';
        }

        // Update URL
        window.history.pushState(null, '', url);

        console.log('🎯 DOM updated, waiting for elements to be ready...');

        // Wait for DOM to be ready, then initialize
        await waitForElements();

        console.log('🔧 Elements ready, initializing components...');

        // Initialize components with proper async handling
        try {
          await initializeComponentsAsync(url);
          console.log('✅ All components initialized successfully');
        } catch (error) {
          console.error('❌ Error initializing components:', error);
        }
      }
    } catch (error) {
      console.warn('SPA load failed, falling back:', error);
      window.location.href = url;
      return;
    } finally {
      hideLoading();
    }
  }

  // Wait for essential DOM elements to be available
  async function waitForElements() {
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const pathname = window.location.pathname;
      let requiredElements = [];

      if (pathname.includes('/items')) {
        requiredElements = ['#itemSearch', '#itemsTableContainer'];
      } else if (pathname.includes('/employees')) {
        requiredElements = ['#employeeSearch', '#employeesTableContainer'];
      }

      // Check if required elements exist
      const allExist = requiredElements.every(selector => document.querySelector(selector));

      if (allExist || requiredElements.length === 0) {
        console.log('✅ Required elements found');
        return;
      }

      console.log(`⏳ Waiting for elements... attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }

    console.warn('⚠️ Some elements may not be ready, proceeding anyway');
  }

  // Async component initialization
  async function initializeComponentsAsync() {
    const pathname = window.location.pathname;
    console.log('📍 Initializing components for:', pathname);

    // Initialize page-specific features with the new universal search system
    initializePageSpecificFeatures(pathname);

    // Small delay to ensure event listeners are attached
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize other components
    try {
      initializeFilterComponents();
    } catch (e) {
      console.error('Filter init error:', e);
    }

    // Dashboard fallback
    try {
      if (pathname === '/dashboard' || pathname === '/') {
        initializeDashboardComponents();
      }
    } catch (e) {
      console.error('Page-specific init error:', e);
    }

    // Other systems
    try {
      if (window.EventSystem && window.EventSystem.init) {
        window.EventSystem.init();
      }
    } catch (e) {
      console.error('EventSystem init error:', e);
    }
  }

  // Intercept navigation clicks
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');

    if (!link ||
        !link.href ||
        link.target === '_blank' ||
        link.href.startsWith('mailto:') ||
        link.href.startsWith('tel:') ||
        !link.href.startsWith(window.location.origin) ||
        link.closest('form') ||
        link.closest('.dropdown') ||
        e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    loadPage(link.href);
  }, true);

  // Handle back/forward
  window.addEventListener('popstate', function(e) {
    if (e.state !== null) {
      loadPage(window.location.href);
    }
  });

  // Initialize current state
  if (window.location.pathname !== '/') {
    window.history.replaceState({}, '', window.location.href);
  }

  // Legacy component initialization (fallback)
  function initializePageComponents() {
    console.log('🔧 Legacy component initialization...');
    initializeComponentsAsync().catch(e => console.error('Legacy init error:', e));
  }

  function initializeSearchComponents() {
    console.log('🔍 Initializing search components...');
    // Global search functionality
    const searchInput = document.querySelector('input[name="q"]');
    const itemSearch = document.getElementById('itemSearch');
    const notificationSearch = document.getElementById('searchInput');

    // Dashboard global search
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length > 2) {
          if (window.performGlobalSearch) {
            window.performGlobalSearch(query);
          }
        } else if (window.hideSearchResults) {
          window.hideSearchResults();
        }
      });
    }

    // Items search
    if (itemSearch && window.performItemSearch) {
      console.log('🔍 Initializing global items search...');
      let searchTimeout;
      itemSearch.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();

        if (query.length >= 2) {
          searchTimeout = setTimeout(() => {
            window.performItemSearch(query);
          }, 300);
        }
      });
    }

    // Notification search
    if (notificationSearch && window.applyFilters) {
      notificationSearch.addEventListener('input', debounce(window.applyFilters, 300));
    }

    // Employee search
    const employeeSearch = document.getElementById('employeeSearch');
    if (employeeSearch && window.performEmployeeSearch) {
      let searchTimeout;
      employeeSearch.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();

        if (query.length >= 2) {
          searchTimeout = setTimeout(() => {
            window.performEmployeeSearch(query);
          }, 300);
        }
      });
    }
  }

  function initializeFilterComponents() {
    console.log('🔧 Initializing filter components...');
    // Advanced filters toggle
    const toggleFiltersBtn = document.getElementById('toggleFilters');
    const filtersContainer = document.getElementById('advancedFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');

    if (toggleFiltersBtn && filtersContainer) {
      toggleFiltersBtn.addEventListener('click', function() {
        const isVisible = filtersContainer.style.display !== 'none';
        filtersContainer.style.display = isVisible ? 'none' : 'block';

        const icon = this.querySelector('i');
        if (icon) {
          icon.className = isVisible ? 'fas fa-filter' : 'fas fa-times';
        }
      });
    }

    if (applyFiltersBtn) {
      console.log('🎯 Found applyFilters button, checking for handlers...');
      if (window.applyAdvancedFilters) {
        console.log('✅ Using window.applyAdvancedFilters');
        applyFiltersBtn.addEventListener('click', window.applyAdvancedFilters);
      } else if (window.applyItemFilters) {
        console.log('✅ Using window.applyItemFilters');
        applyFiltersBtn.addEventListener('click', window.applyItemFilters);
      } else {
        console.log('⚠️ No filter function found');
      }
    }
  }

  function initializeDashboardComponents() {
    // Dashboard-specific initialization
    if (window.initializeDashboard) {
      window.initializeDashboard();
    }
  }

  function initializeItemsComponents() {
    console.log('🔧 Items page - legacy initialization');
    initializeUniversalSearch('items');
  }

  function initializeEmployeesComponents() {
    console.log('🔧 Employees page - legacy initialization');
    initializeUniversalSearch('employees');
  }

  // Initialize page-specific functionality
  function initializePageSpecificFeatures(url) {
    console.log('🎯 Initializing page-specific features for:', url);

    // Detect page type
    let pageType = 'unknown';
    if (url.includes('/items') || url.includes('/assets')) {
      pageType = 'items';
    } else if (url.includes('/employees')) {
      pageType = 'employees';
    }

    // Call page-specific initialization functions
    if (pageType === 'items' && typeof window.initializeItemsPage === 'function') {
      console.log('📦 Calling items page initialization...');
      setTimeout(() => {
        window.initializeItemsPage();
      }, 150);
    } else if (pageType === 'employees' && typeof window.initializeEmployeesPage === 'function') {
      console.log('👥 Calling employees page initialization...');
      setTimeout(() => {
        window.initializeEmployeesPage();
      }, 150);
    }

    console.log(`✅ Page-specific features initialized for ${pageType}`);
  }





  // Debounce utility
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Expose for other scripts
  window.spaNavigationActive = true;
  window.spaController = { navigateToUrl: loadPage };
  window.initializePageComponents = initializePageComponents;

  // Debug helper - manually reinitialize current page
  window.debugReinitPage = function() {
    console.log('🔧 Manual reinitialization triggered');
    initializePageComponents();
  };

})();
