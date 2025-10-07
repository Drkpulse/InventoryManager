const db = require('../config/db');
const { getRecentActivities } = require('../utils/historyLogger');
const { translate } = require('../utils/translations');


exports.getDashboard = async (req, res) => {
  try {
    // Get basic stats - ensure COUNT(*) has alias for easier access
    const itemsResult = await db.query('SELECT COUNT(*) as count FROM items');
    const employeesResult = await db.query('SELECT COUNT(*) as count FROM employees WHERE left_date IS NULL');
    const departmentsResult = await db.query('SELECT COUNT(*) as count FROM departments');
    const unassignedResult = await db.query('SELECT COUNT(*) as count FROM items WHERE assigned_to IS NULL');
    const recentActivities = await getRecentActivities(10); // Limit to 10, or any number you prefer


    // Ensure we get empty arrays if no data instead of null
    // Get items by type for chart with fallback for empty results
    const itemsByTypeResult = await db.query(`
      SELECT t.name, COUNT(i.id) as count
      FROM types t
      LEFT JOIN items i ON t.id = i.type_id
      GROUP BY t.id, t.name
      ORDER BY count DESC
    `);

    // Get recent items
    const recentItemsResult = await db.query(`
      SELECT i.id, i.cep_brc, i.name, t.name as type_name,
             e.name as assigned_to_name, i.assigned_to
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    // Get recent purchases with proper handling of null sum
    const recentPurchasesResult = await db.query(`
      SELECT s.receipt, s.supplier, s.date_acquired,
             COUNT(i.id) as item_count,
             COALESCE(SUM(i.price), 0) as total_price
      FROM sales s
      LEFT JOIN items i ON s.receipt = i.receipt
      GROUP BY s.receipt, s.supplier, s.date_acquired
      ORDER BY s.date_acquired DESC
      LIMIT 5
    `);

    // Get employees by department
    const deptEmployeesResult = await db.query(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.dept_id AND e.left_date IS NULL
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `);

    res.render('layout', {
      title: 'Dashboard',
      body: 'dashboard/index',
      stats: {
        itemCount: parseInt(itemsResult.rows[0]?.count || 0),
        employeeCount: parseInt(employeesResult.rows[0]?.count || 0),
        departmentCount: parseInt(departmentsResult.rows[0]?.count || 0),
        unassignedCount: parseInt(unassignedResult.rows[0]?.count || 0)
      },
      itemsByType: itemsByTypeResult.rows || [],
      recentItems: recentItemsResult.rows || [],
      recentPurchases: recentPurchasesResult.rows || [],
      deptEmployees: deptEmployeesResult.rows || [],
      recentActivities,
      user: req.session.user,
      t: req.t || ((key) => translate(key, req.language)),
      currentLanguage: req.language
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};

exports.searchAssets = async (req, res) => {
  try {
    // Handle both 'q' and 'query' parameter names for compatibility
    const query = req.query.q || req.query.query;
    const { category, page = 1, limit = 15, format } = req.query;

    console.log('🔍 SEARCH DEBUG - Request received:');
    console.log('   Query:', JSON.stringify(query));
    console.log('   Category:', category);
    console.log('   Format:', format);
    console.log('   All query params:', JSON.stringify(req.query));

    // For HTML format (search results page), handle empty queries differently
    if (format === 'html' && (!query || query.trim().length === 0)) {
      // Show recent items when no search query on search page
      try {
        const recentItems = await db.query(`
          SELECT i.id, i.cep_brc, i.name, t.name as type_name, b.name as brand_name,
                 e.name as assigned_to_name, d.name as department_name,
                 l.name as location_name, i.price, s.date_acquired,
                 CASE WHEN i.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END as status
          FROM items i
          LEFT JOIN types t ON i.type_id = t.id
          LEFT JOIN brands b ON i.brand_id = b.id
          LEFT JOIN employees e ON i.assigned_to = e.id
          LEFT JOIN departments d ON e.dept_id = d.id
          LEFT JOIN locations l ON i.location_id = l.id
          LEFT JOIN sales s ON i.receipt = s.receipt
          ORDER BY i.created_at DESC
          LIMIT 20
        `);

        const formattedResults = {
          Items: recentItems.rows.map(item => ({
            id: item.id,
            title: item.name,
            subtitle: `${item.type_name || 'Unknown Type'} • ${item.brand_name || 'Unknown Brand'}`,
            identifier: item.cep_brc,
            icon: 'laptop',
            url: `/items/${item.id}`,
            category: 'Items',
            price: item.price,
            assignedTo: item.assigned_to_name,
            department: item.department_name,
            location: item.location_name,
            status: item.status
          }))
        };

        return res.render('layout', {
          title: 'Search Results',
          body: 'dashboard/search-results',
          searchQuery: '',
          searchResults: {
            results: formattedResults,
            totalResults: recentItems.rows.length,
            searchTime: 0
          },
          user: req.session.user,
          currentPage: 1,
          totalPages: 1,
          category: category || 'all',
          getCategoryIcon: (cat) => ({ 'Items': 'laptop', 'Employees': 'user', 'Departments': 'building', 'Locations': 'map-marker-alt' }[cat] || 'folder'),
          t: req.t || ((key) => translate(key, req.language)),
          currentLanguage: req.language
        });
      } catch (error) {
        console.error('Error loading recent items:', error);
      }
    }

    // Validate query parameter for AJAX requests
    if (!query || query.length < 2) {
      console.log('❌ SEARCH DEBUG - Query too short or empty:', query);
      if (format === 'html') {
        console.log('❌ SEARCH DEBUG - Returning empty HTML results for short query');
        return res.render('layout', {
          title: 'Search Results',
          body: 'dashboard/search-results',
          searchQuery: query || '',
          searchResults: { results: {}, totalResults: 0, searchTime: 0 },
          user: req.session.user,
          currentPage: 1,
          totalPages: 0,
          category: category || 'all',
          getCategoryIcon: (cat) => ({ 'Items': 'laptop', 'Employees': 'user', 'Departments': 'building', 'Locations': 'map-marker-alt' }[cat] || 'folder'),
          t: req.t || ((key) => translate(key, req.language)),
          currentLanguage: req.language
        });
      }
      return res.json({ results: [] });
    }

    console.log('✅ SEARCH DEBUG - Query validation passed, proceeding with search');

    // Create a sanitized query parameter for SQL
    const sanitizedQuery = `%${query.replace(/[%_]/g, char => `\\${char}`)}%`;
    console.log('🔍 SEARCH DEBUG - Sanitized query:', sanitizedQuery);

    // Initialize results arrays
    let searchResult = { rows: [] };
    let employeeResult = { rows: [] };
    let locationResult = { rows: [] };

    try {
      console.log('🔍 SEARCH DEBUG - Executing items search query...');
      // Search for items
      searchResult = await db.query(`
        SELECT i.id, i.cep_brc, i.name, t.name as type_name, b.name as brand_name,
               e.name as assigned_to_name, d.name as department_name,
               l.name as location_name,
               i.price, s.date_acquired,
               CASE WHEN i.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END as status
        FROM items i
        LEFT JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN employees e ON i.assigned_to = e.id
        LEFT JOIN departments d ON e.dept_id = d.id
        LEFT JOIN locations l ON i.location_id = l.id
        LEFT JOIN sales s ON i.receipt = s.receipt
        WHERE i.cep_brc ILIKE $1
           OR i.name ILIKE $1
           OR t.name ILIKE $1
           OR b.name ILIKE $1
           OR e.name ILIKE $1
           OR COALESCE(d.name, '') ILIKE $1
           OR COALESCE(l.name, '') ILIKE $1
        ORDER BY i.name
        LIMIT 20
      `, [sanitizedQuery]);
      console.log('✅ SEARCH DEBUG - Items search completed. Found:', searchResult.rows.length, 'items');
      console.log('📊 SEARCH DEBUG - Sample items:', searchResult.rows.slice(0, 3).map(item => ({ id: item.id, name: item.name })));

      // If no results found, let's see what items actually exist in the database
      if (searchResult.rows.length === 0) {
        console.log('🔍 SEARCH DEBUG - No items found, checking what items exist...');
        const allItems = await db.query(`
          SELECT i.id, i.name, i.cep_brc, t.name as type_name
          FROM items i
          LEFT JOIN types t ON i.type_id = t.id
          ORDER BY i.id
          LIMIT 10
        `);
        console.log('📊 SEARCH DEBUG - Sample database items:', allItems.rows.map(item => ({
          id: item.id,
          name: item.name,
          cep: item.cep_brc,
          type: item.type_name
        })));

        // For debugging, let's also try a broader search to see if there are any items
        console.log('🔍 SEARCH DEBUG - Trying broader search for debugging...');
        const broadSearch = await db.query(`
          SELECT i.id, i.name, i.cep_brc, t.name as type_name
          FROM items i
          LEFT JOIN types t ON i.type_id = t.id
          WHERE i.name IS NOT NULL
          ORDER BY i.id
          LIMIT 5
        `);
        console.log('📊 SEARCH DEBUG - Broader search results:', broadSearch.rows.map(item => ({
          id: item.id,
          name: item.name
        })));

        // If we have items in the database, let's show them as fallback results for testing
        if (broadSearch.rows.length > 0 && format === 'html') {
          console.log('🔍 SEARCH DEBUG - Using fallback results for HTML format');
          searchResult = broadSearch;
        }
      }
    } catch (err) {
      console.error('❌ SEARCH DEBUG - Error searching items:', err);
      // Continue execution even if this query fails
    }

    try {
      // Search employees
      employeeResult = await db.query(`
        SELECT e.id, e.name, e.cep,
               d.name as department_name,
               l.name as location_name,
               'employee' as type
        FROM employees e
        LEFT JOIN departments d ON e.dept_id = d.id
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE e.name ILIKE $1
           OR COALESCE(e.cep, '') ILIKE $1
           OR COALESCE(d.name, '') ILIKE $1
           OR COALESCE(l.name, '') ILIKE $1
        ORDER BY e.name
        LIMIT 10
      `, [sanitizedQuery]);
    } catch (err) {
      console.error('Error searching employees:', err);
      // Continue execution even if this query fails
    }

    try {
      // Search locations
      locationResult = await db.query(`
        SELECT l.id, l.name,
               COUNT(e.id) as employee_count
        FROM locations l
        LEFT JOIN employees e ON l.id = e.location_id
        WHERE l.name ILIKE $1
           OR COALESCE(l.description, '') ILIKE $1
        GROUP BY l.id, l.name
        ORDER BY l.name
        LIMIT 5
      `, [sanitizedQuery]);
    } catch (err) {
      console.error('Error searching locations:', err);
      // Continue execution even if this query fails
    }

    // Format results for frontend
    console.log('📊 SEARCH DEBUG - Formatting results...');
    console.log('   Items found:', searchResult.rows.length);
    console.log('   Employees found:', employeeResult.rows.length);
    console.log('   Locations found:', locationResult.rows.length);

    const formattedResults = {
      Items: searchResult.rows.map(item => ({
        id: item.id,
        title: item.name,
        subtitle: item.type_name || 'Unknown Type',
        identifier: item.cep_brc,
        icon: 'laptop',
        url: `/items/${item.id}/${item.cep_brc}`,
        status: item.status,
        category: 'Items'
      })),
      Employees: employeeResult.rows.map(emp => ({
        id: emp.id,
        title: emp.name,
        subtitle: emp.department_name || 'No Department',
        identifier: emp.cep || '',
        icon: 'person',
        url: `/employees/${emp.id}`,
        category: 'Employees'
      })),
      Locations: locationResult.rows.map(loc => ({
        id: loc.id,
        title: loc.name,
        subtitle: `${loc.employee_count} employees`,
        identifier: loc.id,
        icon: 'place',
        url: `/references/locations`,
        category: 'Locations'
      }))
    };

    console.log('✅ SEARCH DEBUG - Formatted results:', {
      Items: formattedResults.Items.length,
      Employees: formattedResults.Employees.length,
      Locations: formattedResults.Locations.length
    });

    // Handle HTML format for search results page
    if (format === 'html') {
      const totalResults = (formattedResults.Items?.length || 0) +
                          (formattedResults.Employees?.length || 0) +
                          (formattedResults.Locations?.length || 0);

      console.log('🌐 SEARCH DEBUG - Rendering HTML results page');
      console.log('   Total results:', totalResults);
      console.log('   Search query:', query);
      console.log('   Category:', category);

      return res.render('layout', {
        title: `Search Results for "${query}"`,
        body: 'dashboard/search-results',
        searchQuery: query,
        searchResults: {
          results: formattedResults,
          totalResults,
          searchTime: 0
        },
        user: req.session.user,
        currentPage: parseInt(page),
        totalPages: 1,
        category: category || 'all',
        getCategoryIcon: (cat) => ({ 'Items': 'laptop', 'Employees': 'user', 'Departments': 'building', 'Locations': 'map-marker-alt' }[cat] || 'folder'),
        t: req.t || ((key) => translate(key, req.language)),
        currentLanguage: req.language
      });
    }

    res.json({ results: formattedResults });
  } catch (error) {
    console.error('Search error:', error);
    if (format === 'html') {
      return res.render('layout', {
        title: 'Search Error',
        body: 'dashboard/search-results',
        searchQuery: query || '',
        searchResults: { results: {}, totalResults: 0, searchTime: 0, error: error.message },
        user: req.session.user,
        currentPage: 1,
        totalPages: 0,
        category: category || 'all',
        getCategoryIcon: (cat) => ({ 'Items': 'laptop', 'Employees': 'user', 'Departments': 'building', 'Locations': 'map-marker-alt' }[cat] || 'folder'),
        t: req.t || ((key) => translate(key, req.language)),
        currentLanguage: req.language
      });
    }
    res.status(500).json({ error: 'An error occurred during search' });
  }
};

exports.getAssets = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Extract filter parameters
    const typeFilter = req.query.type;
    const deptFilter = req.query.dept;
    const statusFilter = req.query.status;
    const locationFilter = req.query.location;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build WHERE clause dynamically
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (typeFilter) {
      paramCount++;
      whereConditions.push(`t.name = $${paramCount}`);
      queryParams.push(typeFilter);
    }

    if (deptFilter) {
      paramCount++;
      whereConditions.push(`d.name = $${paramCount}`);
      queryParams.push(deptFilter);
    }

    if (statusFilter === 'assigned') {
      whereConditions.push(`i.assigned_to IS NOT NULL`);
    } else if (statusFilter === 'unassigned') {
      whereConditions.push(`i.assigned_to IS NULL`);
    }

    if (locationFilter) {
      paramCount++;
      whereConditions.push(`l.name = $${paramCount}`);
      queryParams.push(locationFilter);
    }

    if (minPrice) {
      paramCount++;
      whereConditions.push(`i.price >= $${paramCount}`);
      queryParams.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      paramCount++;
      whereConditions.push(`i.price <= $${paramCount}`);
      queryParams.push(parseFloat(maxPrice));
    }

    if (startDate) {
      paramCount++;
      whereConditions.push(`s.date_acquired >= $${paramCount}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereConditions.push(`s.date_acquired <= $${paramCount}`);
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get items with pagination
    const itemsQuery = `
      SELECT
        i.id, i.cep_brc, i.name,
        t.name as type_name,
        b.name as brand_name,
        e.name as assigned_to_name,
        d.name as department_name,
        l.name as location_name,
        i.price,
        s.date_acquired,
        CASE WHEN i.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END as status,
        i.assigned_to
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    // Add the limit and offset parameters
    queryParams.push(limit);
    queryParams.push(offset);

    const itemsResult = await db.query(itemsQuery, queryParams);

    // Send the response
    res.json({
      items: itemsResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      error: 'Failed to fetch assets',
      message: error.message
    });
  }
};
