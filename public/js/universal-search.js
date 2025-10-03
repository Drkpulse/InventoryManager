/**
 * Universal Search & Filter System
 * Reusable component for real-time table filtering
 */

class UniversalSearch {
  constructor(config) {
    this.config = {
      searchInputId: config.searchInputId,
      tableSelector: config.tableSelector,
      noResultsId: config.noResultsId || null,
      searchDelay: config.searchDelay || 300,
      minSearchLength: config.minSearchLength || 2,
      searchColumns: config.searchColumns || [], // Array of column indices to search
      caseSensitive: config.caseSensitive || false,
      highlightMatches: config.highlightMatches !== false,
      placeholder: config.placeholder || 'Search...',
      debounceTimeout: null
    };

    this.searchInput = null;
    this.tableBody = null;
    this.allRows = [];
    this.isInitialized = false;

    console.log('🔍 UniversalSearch created with config:', this.config);
  }

  /**
   * Initialize the search system
   */
  async init() {
    console.log('🚀 Initializing UniversalSearch...');

    try {
      await this.waitForElements();
      this.cacheElements();
      this.setupEventListeners();
      this.styleSearchInput();
      this.isInitialized = true;

      console.log('✅ UniversalSearch initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize UniversalSearch:', error);
      return false;
    }
  }

  /**
   * Wait for DOM elements to be available
   */
  async waitForElements() {
    const maxAttempts = 20;
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const checkElements = () => {
        const searchInput = document.getElementById(this.config.searchInputId);
        const tableContainer = document.querySelector(this.config.tableSelector);

        if (searchInput && tableContainer) {
          console.log('✅ Search elements found');
          resolve();
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`Elements not found after ${maxAttempts} attempts`));
          } else {
            console.log(`⏳ Waiting for elements... (${attempts}/${maxAttempts})`);
            setTimeout(checkElements, 150);
          }
        }
      };

      checkElements();
    });
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.searchInput = document.getElementById(this.config.searchInputId);
    this.tableBody = document.querySelector(this.config.tableSelector);

    if (this.tableBody) {
      this.allRows = Array.from(this.tableBody.querySelectorAll('tr'));
      console.log(`📋 Cached ${this.allRows.length} table rows`);
    }

    // Cache no results element if specified
    if (this.config.noResultsId) {
      this.noResultsElement = document.getElementById(this.config.noResultsId);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.searchInput) return;

    // Clear any existing listeners by cloning the element
    const newSearchInput = this.searchInput.cloneNode(true);
    this.searchInput.parentNode.replaceChild(newSearchInput, this.searchInput);
    this.searchInput = newSearchInput;

    // Set placeholder
    this.searchInput.placeholder = this.config.placeholder;

    // Add input event listener with debouncing
    this.searchInput.addEventListener('input', (e) => {
      clearTimeout(this.debounceTimeout);

      this.debounceTimeout = setTimeout(() => {
        this.performSearch(e.target.value);
      }, this.config.searchDelay);
    });

    // Add focus/blur events for better UX
    this.searchInput.addEventListener('focus', () => {
      this.searchInput.parentElement.classList.add('search-focused');
    });

    this.searchInput.addEventListener('blur', () => {
      this.searchInput.parentElement.classList.remove('search-focused');
    });

    console.log('🎯 Event listeners attached');
  }

  /**
   * Style the search input
   */
  styleSearchInput() {
    if (!this.searchInput) return;

    // Add CSS classes for styling
    this.searchInput.classList.add('universal-search-input');

    // Ensure parent has proper styling
    const parent = this.searchInput.parentElement;
    if (parent) {
      parent.classList.add('universal-search-container');
    }
  }

  /**
   * Perform the actual search
   */
  performSearch(query) {
    if (!this.isInitialized || !this.tableBody) {
      console.warn('⚠️ Search not initialized or table not found');
      return;
    }

    const trimmedQuery = query.trim();

    console.log(`🔍 Searching for: "${trimmedQuery}"`);

    // Show all rows if query is empty or too short
    if (trimmedQuery.length === 0) {
      this.showAllRows();
      this.hideNoResults();
      return;
    }

    if (trimmedQuery.length < this.config.minSearchLength) {
      return;
    }

    // Perform the search
    const searchTerm = this.config.caseSensitive ? trimmedQuery : trimmedQuery.toLowerCase();
    let visibleCount = 0;

    this.allRows.forEach(row => {
      const isMatch = this.isRowMatch(row, searchTerm);

      if (isMatch) {
        row.style.display = '';
        if (this.config.highlightMatches) {
          this.highlightRow(row, searchTerm);
        }
        visibleCount++;
      } else {
        row.style.display = 'none';
        this.removeHighlight(row);
      }
    });

    // Handle no results
    if (visibleCount === 0) {
      this.showNoResults();
    } else {
      this.hideNoResults();
    }

    console.log(`📊 Search complete: ${visibleCount} results found`);
  }

  /**
   * Check if a row matches the search term
   */
  isRowMatch(row, searchTerm) {
    const cells = row.querySelectorAll('td');

    // If specific columns are configured, search only those
    if (this.config.searchColumns.length > 0) {
      return this.config.searchColumns.some(columnIndex => {
        const cell = cells[columnIndex];
        if (!cell) return false;

        const cellText = this.config.caseSensitive ?
          cell.textContent.trim() :
          cell.textContent.trim().toLowerCase();

        return cellText.includes(searchTerm);
      });
    }

    // Search all columns
    return Array.from(cells).some(cell => {
      const cellText = this.config.caseSensitive ?
        cell.textContent.trim() :
        cell.textContent.trim().toLowerCase();

      return cellText.includes(searchTerm);
    });
  }

  /**
   * Show all rows
   */
  showAllRows() {
    this.allRows.forEach(row => {
      row.style.display = '';
      this.removeHighlight(row);
    });
  }

  /**
   * Highlight matching text in a row
   */
  highlightRow(row, searchTerm) {
    // Remove existing highlights first
    this.removeHighlight(row);

    const cells = row.querySelectorAll('td');
    const searchColumns = this.config.searchColumns.length > 0 ?
      this.config.searchColumns :
      Array.from({length: cells.length}, (_, i) => i);

    searchColumns.forEach(columnIndex => {
      const cell = cells[columnIndex];
      if (!cell) return;

      const originalText = cell.textContent;
      const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, this.config.caseSensitive ? 'g' : 'gi');

      if (regex.test(originalText)) {
        const highlightedHTML = originalText.replace(regex, '<mark class="search-highlight">$1</mark>');
        cell.innerHTML = highlightedHTML;
      }
    });
  }

  /**
   * Remove highlights from a row
   */
  removeHighlight(row) {
    const highlights = row.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize();
    });
  }

  /**
   * Show no results message
   */
  showNoResults() {
    if (this.noResultsElement) {
      this.noResultsElement.style.display = 'block';
    }
  }

  /**
   * Hide no results message
   */
  hideNoResults() {
    if (this.noResultsElement) {
      this.noResultsElement.style.display = 'none';
    }
  }

  /**
   * Escape special regex characters
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Refresh the search (useful after table content changes)
   */
  refresh() {
    console.log('🔄 Refreshing search...');
    this.cacheElements();

    // Re-run current search if there's a query
    if (this.searchInput && this.searchInput.value.trim()) {
      this.performSearch(this.searchInput.value);
    }
  }

  /**
   * Clear the search
   */
  clear() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.showAllRows();
      this.hideNoResults();
    }
  }

  /**
   * Destroy the search instance
   */
  destroy() {
    if (this.searchInput) {
      this.searchInput.removeEventListener('input', this.performSearch);
      this.searchInput.removeEventListener('focus', this.styleEvents);
      this.searchInput.removeEventListener('blur', this.styleEvents);
    }

    clearTimeout(this.debounceTimeout);
    this.showAllRows();
    this.isInitialized = false;

    console.log('🗑️ UniversalSearch destroyed');
  }
}

// Global search instances registry
window.SearchInstances = window.SearchInstances || {};

/**
 * Factory function to create and initialize search instances
 */
window.createUniversalSearch = async function(config) {
  console.log('🏗️ Creating UniversalSearch with config:', config);

  const search = new UniversalSearch(config);
  const success = await search.init();

  if (success) {
    // Store in global registry for easy access
    if (config.instanceName) {
      window.SearchInstances[config.instanceName] = search;
    }

    return search;
  }

  return null;
};
