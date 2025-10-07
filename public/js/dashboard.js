document.addEventListener('DOMContentLoaded', function() {
  // Initialize charts if Chart.js is available
  if (typeof Chart !== 'undefined' && window.dashboardData) {
    initializeCharts();
  }

  // Initialize dashboard functionality
  initializeDashboard();
});

function initializeCharts() {
  // Asset Distribution Chart
  const assetCtx = document.getElementById('assetDistributionChart');
  if (assetCtx && window.dashboardData.itemsByType) {
    new Chart(assetCtx, {
      type: 'doughnut',
      data: {
        labels: window.dashboardData.itemsByType.map(item => item.name),
        datasets: [{
          data: window.dashboardData.itemsByType.map(item => item.count),
          backgroundColor: [
            '#4a6fa5',
            '#166088',
            '#2a9d8f',
            '#f6c23e',
            '#e63946',
            '#36b9cc'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  // Department Employees Chart
  const deptCtx = document.getElementById('deptEmployeesChart');
  if (deptCtx && window.dashboardData.deptEmployees) {
    new Chart(deptCtx, {
      type: 'bar',
      data: {
        labels: window.dashboardData.deptEmployees.map(dept => dept.name),
        datasets: [{
          label: 'Employees',
          data: window.dashboardData.deptEmployees.map(dept => dept.count),
          backgroundColor: '#4a6fa5'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
}

function performGlobalSearch(query) {
  if (query.length < 2) {
    hideSearchResults();
    return;
  }

  fetch(`/dashboard/search?query=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      displaySearchResults(data.results);
    })
    .catch(error => {
      console.error('Search error:', error);
      hideSearchResults();
    });
}

function displaySearchResults(results) {
  const searchContainer = document.querySelector('.search-container');
  let searchResults = searchContainer.querySelector('.search-results');

  if (!searchResults) {
    searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    searchContainer.appendChild(searchResults);
  }

  if (!results || Object.keys(results).length === 0) {
    searchResults.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-title">No results found</div>
        <div class="search-result-subtitle">Try a different search term</div>
      </div>
    `;
  } else {
    let html = '';

    Object.keys(results).forEach(category => {
      if (results[category].length > 0) {
        html += `<div class="search-category">
          <div class="search-category-header">${category}</div>
        `;

        results[category].forEach(item => {
          html += `
            <div class="search-result-item" onclick="window.location.href='${item.url}'">
              <div class="search-result-title">
                <i class="fas fa-${item.icon}"></i> ${item.title}
              </div>
              <div class="search-result-subtitle">${item.subtitle}</div>
            </div>
          `;
        });

        html += '</div>';
      }
    });

    searchResults.innerHTML = html;
  }

  searchResults.classList.add('active');
}

function hideSearchResults() {
  const searchResults = document.querySelector('.search-results');
  if (searchResults) {
    searchResults.classList.remove('active');
  }
}

function initializeDashboard() {
  // Global search functionality
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performGlobalSearch(this.value);
      }, 300);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-container')) {
        hideSearchResults();
      }
    });
  }

  // Advanced filters functionality
  const toggleFiltersBtn = document.getElementById('toggleFilters');
  const filtersContainer = document.getElementById('advancedFilters');

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

  // Apply filters button
  const applyFiltersBtn = document.getElementById('applyFilters');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function() {
      loadAssets(1);
    });
  }

  // Reset filters button
  const resetFiltersBtn = document.getElementById('resetFilters');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      // Reset all filter inputs
      document.querySelectorAll('#advancedFilters select, #advancedFilters input').forEach(input => {
        if (input.type === 'select-one') {
          input.selectedIndex = 0;
        } else {
          input.value = '';
        }
      });
      loadAssets(1);
    });
  }

  // Pagination
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function() {
      const currentPage = parseInt(this.dataset.currentPage) || 1;
      if (currentPage > 1) {
        loadAssets(currentPage - 1);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
      const currentPage = parseInt(this.dataset.currentPage) || 1;
      const totalPages = parseInt(this.dataset.totalPages) || 1;
      if (currentPage < totalPages) {
        loadAssets(currentPage + 1);
      }
    });
  }

  // Load initial assets data
  loadAssets(1);

  // Setup dropdown functionality
  setupDropdowns();
}

function performGlobalSearch(query) {
  if (query.length < 2) {
    hideSearchResults();
    return;
  }

  fetch(`/dashboard/search?query=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      displaySearchResults(data.results);
    })
    .catch(error => {
      console.error('Search error:', error);
      hideSearchResults();
    });
}

function displaySearchResults(results) {
  const searchContainer = document.querySelector('.search-container');
  let searchResults = searchContainer.querySelector('.search-results');

  if (!searchResults) {
    searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    searchContainer.appendChild(searchResults);
  }

  if (!results || Object.keys(results).length === 0) {
    searchResults.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-title">No results found</div>
        <div class="search-result-subtitle">Try a different search term</div>
      </div>
    `;
  } else {
    let html = '';

    Object.keys(results).forEach(category => {
      if (results[category].length > 0) {
        html += `<div class="search-category">
          <div class="search-category-header">${category}</div>
        `;

        results[category].forEach(item => {
          html += `
            <div class="search-result-item" onclick="window.location.href='${item.url}'">
              <div class="search-result-title">
                <i class="fas fa-${item.icon}"></i> ${item.title}
              </div>
              <div class="search-result-subtitle">${item.subtitle}</div>
            </div>
          `;
        });

        html += '</div>';
      }
    });

    searchResults.innerHTML = html;
  }

  searchResults.classList.add('active');
}

function hideSearchResults() {
  const searchResults = document.querySelector('.search-results');
  if (searchResults) {
    searchResults.classList.remove('active');
  }
}

function initializeDashboard() {
  // Global search functionality
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performGlobalSearch(this.value);
      }, 300);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-container')) {
        hideSearchResults();
      }
    });
  }

  // Advanced filters functionality
  const toggleFiltersBtn = document.getElementById('toggleFilters');
  const filtersContainer = document.getElementById('advancedFilters');

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

  // Apply filters button
  const applyFiltersBtn = document.getElementById('applyFilters');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function() {
      loadAssets(1);
    });
  }

  // Reset filters button
  const resetFiltersBtn = document.getElementById('resetFilters');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      // Reset all filter inputs
      document.querySelectorAll('#advancedFilters select, #advancedFilters input').forEach(input => {
        if (input.type === 'select-one') {
          input.selectedIndex = 0;
        } else {
          input.value = '';
        }
      });
      loadAssets(1);
    });
  }

  // Pagination
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function() {
      const currentPage = parseInt(this.dataset.currentPage) || 1;
      if (currentPage > 1) {
        loadAssets(currentPage - 1);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
      const currentPage = parseInt(this.dataset.currentPage) || 1;
      const totalPages = parseInt(this.dataset.totalPages) || 1;
      if (currentPage < totalPages) {
        loadAssets(currentPage + 1);
      }
    });
  }

  // Load initial assets data
  loadAssets(1);

  // Setup dropdown functionality
  setupDropdowns();
}

function loadAssets(page = 1) {
  const limit = 10;

  // Get filter values
  const typeFilter = document.getElementById('typeFilter')?.value || '';
  const deptFilter = document.getElementById('deptFilter')?.value || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';
  const locationFilter = document.getElementById('locationFilter')?.value || '';
  const minPrice = document.getElementById('minPrice')?.value || '';
  const maxPrice = document.getElementById('maxPrice')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';

  // Build query parameters
  const params = new URLSearchParams({
    page: page,
    limit: limit,
    ...(typeFilter && { type: typeFilter }),
    ...(deptFilter && { dept: deptFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(locationFilter && { location: locationFilter }),
    ...(minPrice && { minPrice: minPrice }),
    ...(maxPrice && { maxPrice: maxPrice }),
    ...(startDate && { startDate: startDate }),
    ...(endDate && { endDate: endDate })
  });

  // Show loading state
  const assetsTable = document.getElementById('assetsTable');
  const tbody = assetsTable?.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr class="loading-row">
        <td colspan="9">
          <div class="loading-spinner"></div>
          <p>Loading assets...</p>
        </td>
      </tr>
    `;
  }

  // Fetch assets data
  fetch(`/dashboard/assets?${params.toString()}`)
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      updateAssetsTable(data.items);
      updatePagination(data.page, data.totalPages, data.total);
    })
    .catch(error => {
      console.error('Error loading assets:', error);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: #dc3545;">
              Error loading assets: ${error.message}
            </td>
          </tr>
        `;
      }
    });
}

function updateAssetsTable(assets) {
  const tbody = document.querySelector('#assetsTable tbody');
  if (!tbody) return;

  if (assets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: #666;">
          No assets found matching your criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = assets.map(asset => `
    <tr>
      <td><span class="badge badge-light">${asset.cep_brc}</span></td>
      <td>
        <a href="/items/${asset.id}/${asset.cep_brc}" class="item-name">${asset.name}</a>
      </td>
      <td>${asset.type_name || 'N/A'}</td>
      <td>${asset.brand_name || 'N/A'}</td>
      <td>
        ${asset.assigned_to_name ?
          `<span class="badge badge-success">${asset.assigned_to_name}</span>` :
          `<span class="badge badge-warning">Unassigned</span>`
        }
      </td>
      <td>${asset.department_name || 'N/A'}</td>
      <td>${asset.date_acquired ? new Date(asset.date_acquired).toLocaleDateString() : 'N/A'}</td>
      <td class="price">${asset.price ? '$' + parseFloat(asset.price).toFixed(2) : 'N/A'}</td>
      <td>
        <span class="status-indicator ${asset.status === 'assigned' ? 'active' : 'inactive'}"></span>
        ${asset.status}
      </td>
    </tr>
  `).join('');
}

function updatePagination(currentPage, totalPages, total) {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');

  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
    prevBtn.dataset.currentPage = currentPage;
    prevBtn.dataset.totalPages = totalPages;
  }

  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.dataset.currentPage = currentPage;
    nextBtn.dataset.totalPages = totalPages;
  }

  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${total} items)`;
  }
}

function setupDropdowns() {
  // Setup dropdown functionality for dashboard
  document.addEventListener('click', function(e) {
    const toggle = e.target.closest('.dropdown-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();

      const dropdown = toggle.closest('.dropdown');
      const menu = dropdown.querySelector('.dropdown-menu');

      // Close all other dropdowns
      document.querySelectorAll('.dropdown-menu.show').forEach(otherMenu => {
        if (otherMenu !== menu) {
          otherMenu.classList.remove('show');
        }
      });

      // Toggle current dropdown
      menu.classList.toggle('show');
    }

    // Close dropdowns when clicking outside
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });
}

// Fullscreen toggle function for dashboard panels
function toggleFullscreen(panel) {
  if (!panel) return;

  if (panel.classList.contains('fullscreen')) {
    panel.classList.remove('fullscreen');
    document.body.classList.remove('panel-fullscreen');
  } else {
    panel.classList.add('fullscreen');
    document.body.classList.add('panel-fullscreen');
  }
}

// Add fullscreen styles
const style = document.createElement('style');
style.textContent = `
  .dashboard-panel.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    background: white;
  }

  body.panel-fullscreen {
    overflow: hidden;
  }

  .dashboard-panel.fullscreen .chart-container {
    height: calc(100vh - 200px);
  }
`;
document.head.appendChild(style);

// Expose dashboard functions globally
window.performGlobalSearch = performGlobalSearch;
window.hideSearchResults = hideSearchResults;
window.displaySearchResults = displaySearchResults;

// Simple search result navigation
document.addEventListener('click', function(e) {
  const searchItem = e.target.closest('.search-result-item');
  if (searchItem) {
    e.preventDefault();
    e.stopPropagation();

    const url = searchItem.getAttribute('data-url') || searchItem.onclick?.toString().match(/window\.location\.href='([^']+)'/)?.[1];
    if (url) {
      // Use simple SPA navigation
      if (window.spaController) {
        window.spaController.navigateToUrl(url);
      } else {
        window.location.href = url;
      }
    }
  }
});
