const db = require('../config/db');
const historyLogger = require('../utils/historyLogger');

const validateItemData = (data) => {
  const errors = [];

  if (!data.cep_brc || data.cep_brc.trim() === '') {
    errors.push('Item ID (CEP/BRC) is required');
  }

  if (!data.name || data.name.trim() === '') {
    errors.push('Item name is required');
  }

  if (!data.type_id) {
    errors.push('Item type is required');
  }

  // Price can be null but if provided must be numeric
  if (data.price && isNaN(parseFloat(data.price))) {
    errors.push('Price must be a valid number');
  }

  // Check for consistent assignment data
  if (data.assigned_to && !data.date_assigned) {
    errors.push('Date assigned is required when assigning to an employee');
  }

  if (data.date_assigned && !data.assigned_to) {
    errors.push('Employee assignment is required when setting assignment date');
  }

  return errors;
};

// Helper to get perPage from query, user settings, or default
function getItemsPerPage(req) {
  const DEFAULT_PER_PAGE = 20;

  // First check URL parameter
  if (req.query.perPage && !isNaN(parseInt(req.query.perPage, 10))) {
    const perPage = parseInt(req.query.perPage, 10);
    if (perPage > 0 && perPage <= 1000) {
      return perPage;
    }
  }

  // Then check user settings
  if (req.session &&
      req.session.user &&
      req.session.user.settings &&
      req.session.user.settings.items_per_page) {
    const userPerPage = parseInt(req.session.user.settings.items_per_page, 10);
    if (!isNaN(userPerPage) && userPerPage > 0 && userPerPage <= 1000) {
      return userPerPage;
    }
  }

  return DEFAULT_PER_PAGE;
}

exports.getAllItems = async (req, res) => {
  try {
    // Parse query parameters for filtering and searching
    const searchTerm = req.query.q || '';
    const typeFilter = req.query.type || '';
    const brandFilter = req.query.brand || '';
    const statusFilter = req.query.status || '';
    const departmentFilter = req.query.department || '';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const page = parseInt(req.query.page) || 1;
    const perPage = getItemsPerPage(req);
    const offset = (page - 1) * perPage;

    // Build the query conditions
    let conditions = [];
    let params = [];
    let paramCount = 1;

    // Search term filter - focus on asset ID, name, and assigned employee
    if (searchTerm && searchTerm.trim()) {
      conditions.push(`(
        LOWER(i.name) LIKE LOWER($${paramCount}) OR
        LOWER(i.cep_brc) LIKE LOWER($${paramCount + 1}) OR
        LOWER(e.name) LIKE LOWER($${paramCount + 2})
      )`);
      const searchPattern = `%${searchTerm.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 3;
    }

    if (typeFilter) {
      conditions.push(`i.type_id = $${paramCount++}`);
      params.push(typeFilter);
    }

    if (brandFilter) {
      conditions.push(`i.brand_id = $${paramCount++}`);
      params.push(brandFilter);
    }

    if (statusFilter) {
      conditions.push(`i.status_id = $${paramCount++}`);
      params.push(statusFilter);
    }

    if (departmentFilter) {
      conditions.push(`e.dept_id = $${paramCount++}`);
      params.push(departmentFilter);
    }

    if (minPrice !== null && !isNaN(minPrice)) {
      conditions.push(`i.price >= $${paramCount++}`);
      params.push(minPrice);
    }

    if (maxPrice !== null && !isNaN(maxPrice)) {
      conditions.push(`i.price <= $${paramCount++}`);
      params.push(maxPrice);
    }

    if (startDate) {
      conditions.push(`s.date_acquired >= $${paramCount++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`s.date_acquired <= $${paramCount++}`);
      params.push(endDate);
    }

    // Create the WHERE clause if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching items for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN statuses st ON i.status_id = st.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / perPage);

    // Get the filtered items with pagination
    const itemsQuery = `
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name, e.id as assigned_to_id, d.name as department_name,
             st.name as status_name, st.color as status_color, st.icon as status_icon, s.date_acquired
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN statuses st ON i.status_id = st.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const itemsResult = await db.query(itemsQuery, params);

    // Get all types for the filter dropdown
    const typesResult = await db.query('SELECT id, name FROM types ORDER BY name');

    // Get all brands for the filter dropdown
    const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

    // Get all departments for the filter dropdown
    const departmentsResult = await db.query('SELECT id, name FROM departments ORDER BY name');

    // Get all statuses for the filter dropdown
    const statusesResult = await db.query('SELECT id, name, description, icon, color, is_active FROM statuses ORDER BY name');

    // Convert price strings to numbers for toFixed to work
    const items = itemsResult.rows.map(item => ({
      ...item,
      price: item.price ? parseFloat(item.price) : 0
    }));

  const startIndex = offset;
  const endIndex = Math.min(offset + items.length, totalItems);

  const templateData = {
    title: 'Inventory Items',
    body: 'items/index',
    items: items,
    types: typesResult.rows,
    brands: brandsResult.rows,
    departments: departmentsResult.rows,
    statuses: statusesResult.rows,
    selectedType: typeFilter,
    currentPage: page,
    totalPages: totalPages,
    totalItems: totalItems,
    perPage,
    startIndex,
    endIndex,
    user: req.session.user,
    t: req.t,
    currentLanguage: req.language,
    req,
    currentFilters: {
      q: searchTerm,
      type: typeFilter,
      brand: brandFilter,
      status: statusFilter,
      department: departmentFilter,
      minPrice: minPrice,
      maxPrice: maxPrice,
      startDate: startDate,
      endDate: endDate
    }
  };

  // Check if this is an AJAX request
  if (req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest') {
    // For AJAX requests, render only the table partial
    res.render('items/_table', templateData, (err, html) => {
      if (err) {
        console.error('Error rendering table partial:', err);
        return res.status(500).send('Error rendering template');
      }

      // Send just the table HTML
      res.send(html);
    });
  } else {
    // For regular requests, render the full layout
    res.render('layout', templateData);
  }
  } catch (error) {
    console.error('Error fetching items:', error);
    if (req.query.ajax === '1' || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      res.status(500).json({ error: 'Server error: ' + error.message });
    } else {
      res.status(500).send('Server error: ' + error.message);
    }
  }
};

// exports.getItemById = async (req, res) => {
//   const DEFAULT_PER_PAGE = 20;
//   if (req.query.perPage && !isNaN(parseInt(req.query.perPage, 10))) {
//     return parseInt(req.query.perPage, 10);
//   }
//   if (
//     req.session &&
//     req.session.user &&
//     req.session.user.settings &&
//     req.session.user.settings.items_per_page
//   ) {
//     const val = parseInt(req.session.user.settings.items_per_page, 10);
//     if (!isNaN(val) && val > 0) {
//       return val;
//     }
//   }
//   return DEFAULT_PER_PAGE;
// }

// Update this method to handle the composite key
exports.getItemById = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    const result = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
      e.name as assigned_to_name, e.id as employee_id,
      s.supplier, s.date_acquired,
      st.name as status_name, st.icon as status_icon, st.color as status_color
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (result.rows.length === 0) {
      return res.status(404).send('Item not found');
    }

    // Convert price to number for template
    const item = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price || 0)
    };

    res.render('layout', {
      title: 'Item Details',
      body: 'items/show',
      item: item,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};

exports.createItemForm = async (req, res) => {
  try {
    // Get types for dropdown
    const types = await db.query('SELECT * FROM types ORDER BY name');
    // Get brands for dropdown
    const brands = await db.query('SELECT * FROM brands ORDER BY name');
    // Get sales receipts for dropdown
    const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
    // Get employees for dropdown
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');
    // Get statuses for dropdown
    const statuses = await db.query('SELECT id, name, description, icon, color, is_active FROM statuses WHERE is_active = true ORDER BY name');

    res.render('layout', {
      title: 'Add New Item',
      body: 'items/create',
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      statuses: statuses.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching data for item form:', error);
    res.status(500).send('Server error');
  }
};

// Update the createItem method to force "New" status:
exports.createItem = async (req, res) => {
  try {
    const {
      cep_brc, name, type_id, price, brand_id,
      model, serial_cod, receipt, date_assigned, assigned_to, description
    } = req.body;

    // Force "New" status for all new items
    let status_id = 1; // Always use "New" status ID

    // Get the "New" status ID from database to be safe
    const newStatusResult = await db.query("SELECT id FROM statuses WHERE name = 'New' LIMIT 1");
    if (newStatusResult.rows.length > 0) {
      status_id = newStatusResult.rows[0].id;
    }

    console.log('Creating new item with data:', {
      cep_brc, name, type_id, price, brand_id,
      model, serial_cod, receipt, date_assigned, assigned_to, status_id
    });

    // Validate input data
    const validationErrors = validateItemData(req.body);

    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);

      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');
      const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
      const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');

      return res.render('layout', {
        title: 'Add New Item',
        body: 'items/create',
        types: types.rows,
        brands: brands.rows,
        sales: sales.rows,
        employees: employees.rows,
        errors: validationErrors,
        formData: req.body,
        user: req.session.user
      });
    }

    // Insert the new item with forced "New" status
    try {
      const result = await db.query(`
        INSERT INTO items (
          cep_brc, name, type_id, price, brand_id, model, serial_cod,
          receipt, date_assigned, assigned_to, description, status_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id, cep_brc
      `, [
        cep_brc, name, type_id,
        price ? parseFloat(price) : null,
        brand_id || null, model || null, serial_cod || null,
        receipt || null,
        date_assigned || null, assigned_to || null, description || null,
        status_id  // Always "New" status
      ]);

      const newItem = result.rows[0];

      // Log the creation in history
      try {
        await historyLogger.logItemHistory(
          newItem.id,
          'created',
          {
            name: name,
            type_id: type_id,
            status_id: status_id,
            initial_status: 'New'
          },
          req.session.user.id
        );
      } catch (historyError) {
        console.error('Failed to log history, but item was created successfully:', historyError);
      }

      console.log('Item created successfully:', newItem);
      res.redirect(`/items/${newItem.id}/${newItem.cep_brc}`);
    } catch (dbError) {
      console.error('Database error creating item:', dbError);

      // Handle specific database errors
      if (dbError.code === '23505') {
        return res.status(400).send('An item with this ID or serial number already exists');
      }

      throw dbError; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('Error creating item:', error);

    // Get reference data for the form to redisplay it
    const types = await db.query('SELECT * FROM types ORDER BY name');
    const brands = await db.query('SELECT * FROM brands ORDER BY name');
    const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');

    return res.render('layout', {
      title: 'Add New Item',
      body: 'items/create',
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      errors: [`Server error: ${error.message}`],
      formData: req.body,
      user: req.session.user
    });
  }
};

exports.updateItemForm = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get the item
    const itemResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name, d.name as department_name,
             st.name as status_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (itemResult.rows.length === 0) {
      return res.status(404).send('Item not found');
    }

    // Get reference data
    const types = await db.query('SELECT * FROM types ORDER BY name');
    const brands = await db.query('SELECT * FROM brands ORDER BY name');
    const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');
    const statuses = await db.query('SELECT id, name, description, icon, color, is_active FROM statuses ORDER BY status_order ASC, name ASC');

    const item = {
      ...itemResult.rows[0],
      price: parseFloat(itemResult.rows[0].price || 0)
    };

    res.render('layout', {
      title: 'Edit Item',
      body: 'items/edit',
      item: item,
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      statuses: statuses.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching item for edit:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};

// Update the assign item method in src/controllers/itemController.js
exports.assignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    const { assigned_to, date_assigned, assignment_notes } = req.body;

    if (!assigned_to || !date_assigned) {
      return res.status(400).json({
        success: false,
        error: 'Employee and assignment date are required'
      });
    }

    // Get the "Assigned" status ID
    const assignedStatusResult = await db.query(
      "SELECT id FROM statuses WHERE name = 'Assigned' LIMIT 1"
    );

    let assignedStatusId = null;
    if (assignedStatusResult.rows.length > 0) {
      assignedStatusId = assignedStatusResult.rows[0].id;
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update the item with assignment and status
      const updateQuery = assignedStatusId
        ? 'UPDATE items SET assigned_to = $1, date_assigned = $2, status_id = $3, updated_at = NOW() WHERE id = $4 AND cep_brc = $5'
        : 'UPDATE items SET assigned_to = $1, date_assigned = $2, updated_at = NOW() WHERE id = $3 AND cep_brc = $4';

      const updateParams = assignedStatusId
        ? [assigned_to, date_assigned, assignedStatusId, id, cep_brc]
        : [assigned_to, date_assigned, id, cep_brc];

      const result = await db.query(updateQuery, updateParams);

      if (result.rowCount === 0) {
        throw new Error('Item not found');
      }

      // Get employee and item details for history
      const employeeResult = await db.query(
        'SELECT e.name, e.cep, d.name as department_name FROM employees e LEFT JOIN departments d ON e.dept_id = d.id WHERE e.id = $1',
        [assigned_to]
      );

      const itemResult = await db.query(
        'SELECT name FROM items WHERE id = $1 AND cep_brc = $2',
        [id, cep_brc]
      );

      const employee = employeeResult.rows[0];
      const item = itemResult.rows[0];

      // Log the assignment in history
      await historyLogger.logItemHistory(
        id,
        'assigned',
        {
          employee_id: assigned_to,
          employee_name: employee.name,
          employee_cep: employee.cep,
          department: employee.department_name,
          assignment_date: date_assigned,
          notes: assignment_notes,
          status_changed_to: assignedStatusId ? 'Assigned' : null
        },
        req.session.user.id
      );

      // Also log assignment in employee history
      await historyLogger.logEmployeeHistory(
        assigned_to,
        'assigned',
        {
          item_id: id,
          item_name: item.name,
          item_cep_brc: cep_brc,
          assignment_date: date_assigned,
          notes: assignment_notes,
          assigned_by: req.session.user.name
        },
        req.session.user.id
      );

      await db.query('COMMIT');

      // With this more robust version:
      const isAjax = req.xhr ||
        req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        (req.headers.accept && req.headers.accept.indexOf('json') > -1);

      if (isAjax) {
        res.json({
          success: true,
          message: `Asset successfully assigned to ${employee.name}`,
          employee: employee,
          status_changed: !!assignedStatusId
        });
      } else {
        res.redirect(`/items/${id}/${cep_brc}?assigned=true`);
      }

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error assigning item:', error);

    // Always return JSON for AJAX requests
    const isAjax = req.xhr ||
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      (req.headers.accept && req.headers.accept.indexOf('json') > -1) ||
      req.headers['content-type'] === 'application/json';

    if (isAjax) {
      res.status(500).json({
        success: false,
        error: 'Failed to assign asset'
      });
    } else {
      res.status(500).render('error', {
        error: 'Failed to assign asset',
        title: 'Error',
        user: req.session.user
      });
    }
  }
};

// Assignment management
exports.assignItemForm = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    console.log('Loading assign form for item:', { id, cep_brc });

    // Get item data
    const itemResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (itemResult.rows.length === 0) {
      return res.status(404).send('Item not found');
    }

    console.log('Item found:', itemResult.rows[0]);

    // Get employees for dropdown
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');
    console.log('Employees loaded:', employees.rows.length);


    res.render('layout', {
      title: 'Assign Item',
      body: 'items/assign',
      item: itemResult.rows[0],
      employees: employees.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading assignment form:', error);
    res.status(500).send('Server error');
  }
};

// Update the unassign item method
exports.unassignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get current assignment details for history
    const currentItemResult = await db.query(`
      SELECT i.assigned_to, i.name, e.name as employee_name, e.cep as employee_cep, d.name as department_name
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (currentItemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const currentItem = currentItemResult.rows[0];

    if (!currentItem.assigned_to) {
      return res.status(400).json({
        success: false,
        error: 'Item is not currently assigned'
      });
    }

    // Get the "Available" status ID
    const availableStatusResult = await db.query(
      "SELECT id FROM statuses WHERE name = 'Available' LIMIT 1"
    );

    let availableStatusId = null;
    if (availableStatusResult.rows.length > 0) {
      availableStatusId = availableStatusResult.rows[0].id;
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update the item to remove assignment and set to Available status
      const updateQuery = availableStatusId
        ? 'UPDATE items SET assigned_to = NULL, date_assigned = NULL, status_id = $1, updated_at = NOW() WHERE id = $2 AND cep_brc = $3'
        : 'UPDATE items SET assigned_to = NULL, date_assigned = NULL, updated_at = NOW() WHERE id = $1 AND cep_brc = $2';

      const updateParams = availableStatusId
        ? [availableStatusId, id, cep_brc]
        : [id, cep_brc];

      await db.query(updateQuery, updateParams);

      // Log the unassignment in history
      await historyLogger.logItemHistory(
        id,
        'unassigned',
        {
          employee_id: currentItem.assigned_to,
          employee_name: currentItem.employee_name,
          employee_cep: currentItem.employee_cep,
          department: currentItem.department_name,
          reason: req.body.reason || 'Manual unassignment',
          status_changed_to: availableStatusId ? 'Available' : null
        },
        req.session.user.id
      );

      // Also log unassignment in employee history
      await historyLogger.logEmployeeHistory(
        currentItem.assigned_to,
        'unassigned',
        {
          item_id: id,
          item_name: currentItem.name,
          item_cep_brc: cep_brc,
          reason: req.body.reason || 'Manual unassignment',
          unassigned_by: req.session.user.name
        },
        req.session.user.id
      );

      await db.query('COMMIT');

      // Redirect based on request type
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({
          success: true,
          message: `Asset unassigned from ${currentItem.employee_name}`,
          status_changed: !!availableStatusId
        });
      } else {
        res.redirect(`/items/${id}/${cep_brc}?unassigned=true`);
      }

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error unassigning item:', error);

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      res.status(500).json({
        success: false,
        error: 'Failed to unassign asset'
      });
    } else {
      res.status(500).render('error', { error: 'Failed to unassign asset' });
    }
  }
};

// Form for creating a new receipt with items
exports.newReceiptForm = async (req, res) => {
  try {
    // Get types for dropdown
    const types = await db.query('SELECT * FROM types ORDER BY name');

    // Get brands for dropdown
    const brands = await db.query('SELECT * FROM brands ORDER BY name');

    res.render('layout', {
      title: 'New Purchase Receipt',
      body: 'items/new-receipt',
      types: types.rows,
      brands: brands.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading form:', error);
    res.status(500).send('Server error');
  }
};

// Create a new receipt and associated items
exports.createReceiptWithItems = async (req, res) => {
  let client = null;

  try {
    // Extract receipt data
    const { receipt, supplier, date_acquired } = req.body;

    // Extract item details (these will be arrays if multiple items)
    const cep_brc = Array.isArray(req.body.cep_brc) ? req.body.cep_brc : [req.body.cep_brc];
    const name = Array.isArray(req.body.name) ? req.body.name : [req.body.name];
    const type_id = Array.isArray(req.body.type_id) ? req.body.type_id : [req.body.type_id];
    const price = Array.isArray(req.body.price) ? req.body.price : [req.body.price];
    const brand_id = Array.isArray(req.body.brand_id) ? req.body.brand_id : [req.body.brand_id];
    const model = Array.isArray(req.body.model) ? req.body.model : [req.body.model];
    const serial_cod = Array.isArray(req.body.serial_cod) ? req.body.serial_cod : [req.body.serial_cod];

    // Validate receipt data
    if (!receipt || !supplier || !date_acquired) {
      return res.status(400).send('Receipt details are required');
    }

    // Validate at least one item is present
    if (!cep_brc[0] || !name[0] || !type_id[0]) {
      return res.status(400).send('At least one item is required with ID, name, and type');
    }

    // Get client for transaction
    client = await db.getClient();

    // Start transaction
    await client.query('BEGIN');

    // Create the receipt
    await client.query(
      'INSERT INTO sales (receipt, supplier, date_acquired) VALUES ($1, $2, $3)',
      [receipt, supplier, date_acquired]
    );

    // Create all the items
    for (let i = 0; i < cep_brc.length; i++) {
      // Skip empty items
      if (!cep_brc[i] || !name[i]) continue;

      await client.query(`
        INSERT INTO items
        (cep_brc, name, type_id, price, brand_id, model, serial_cod, receipt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        cep_brc[i],
        name[i],
        type_id[i],
        price[i] || null,
        brand_id[i] || null,
        model[i] || null,
        serial_cod[i] || null,
        receipt
      ]);
    }

    // Commit the transaction
    await client.query('COMMIT');

    // Redirect to the items page
    res.redirect('/items');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    console.error('Error creating receipt with items:', error);

    // Handle specific database errors
    if (error.code === '23505') {
      return res.status(400).send('A receipt with this ID or an item with duplicate ID/serial already exists');
    }

    res.status(500).send('Server error: ' + error.message);
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.getUnassignedItemsJson = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.id, i.cep_brc, i.name, t.name as type_name, b.name as brand_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      WHERE i.assigned_to IS NULL
      ORDER BY i.name
    `);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error fetching unassigned items:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update the edit item method to handle status changes on assignment
exports.updateItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    const {
      name, type_id, price, brand_id, model, serial_cod, receipt,
      assigned_to, date_assigned, description, status_id,
      warranty_start_date, warranty_months, warranty_end_date
    } = req.body;

    // Get current item data for comparison
    const currentItemResult = await db.query(
      'SELECT assigned_to, status_id FROM items WHERE id = $1 AND cep_brc = $2',
      [id, cep_brc]
    );

    if (currentItemResult.rows.length === 0) {
      return res.status(404).render('error', { error: 'Item not found' });
    }

    const currentItem = currentItemResult.rows[0];
    let finalStatusId = status_id ? parseInt(status_id) : null;

    // Auto-adjust status based on assignment changes
    if (assigned_to && assigned_to !== '' && !currentItem.assigned_to) {
      // Item is being assigned
      const assignedStatusResult = await db.query(
        "SELECT id FROM statuses WHERE name = 'Assigned' LIMIT 1"
      );
      if (assignedStatusResult.rows.length > 0) {
        finalStatusId = parseInt(assignedStatusResult.rows[0].id);
      }
    } else if ((!assigned_to || assigned_to === '') && currentItem.assigned_to) {
      // Item is being unassigned
      const availableStatusResult = await db.query(
        "SELECT id FROM statuses WHERE name = 'Available' LIMIT 1"
      );
      if (availableStatusResult.rows.length > 0) {
        finalStatusId = parseInt(availableStatusResult.rows[0].id);
      }
    }

    // Validate input data
    const validationErrors = validateItemData(req.body);

    if (validationErrors.length > 0) {
      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');
      const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
      const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');
      const statuses = await db.query('SELECT id, name, description, icon, color, is_active FROM statuses ORDER BY status_order ASC, name ASC');

      const item = await db.query(`
        SELECT i.*, t.name as type_name, b.name as brand_name,
               e.name as assigned_to_name, s.supplier, s.date_acquired,
               st.name as status_name
        FROM items i
        LEFT JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN employees e ON i.assigned_to = e.id
        LEFT JOIN sales s ON i.receipt = s.receipt
        LEFT JOIN statuses st ON i.status_id = st.id
        WHERE i.id = $1 AND i.cep_brc = $2
      `, [id, cep_brc]);

      return res.render('layout', {
        title: 'Edit Asset',
        body: 'items/edit',
        item: item.rows[0],
        types: types.rows,
        brands: brands.rows,
        sales: sales.rows,
        employees: employees.rows,
        statuses: statuses.rows,
        errors: validationErrors,
        user: req.session.user
      });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update the item
      const result = await db.query(`
        UPDATE items SET
          name = $1, type_id = $2, price = $3, brand_id = $4, model = $5,
          serial_cod = $6, receipt = $7, assigned_to = $8, date_assigned = $9,
          description = $10, status_id = $11, warranty_start_date = $12,
          warranty_months = $13, warranty_end_date = $14, updated_at = NOW()
        WHERE id = $15 AND cep_brc = $16
        RETURNING *
      `, [
        name, type_id,
        price ? parseFloat(price) : null,
        brand_id || null, model || null, serial_cod || null,
        receipt || null, (assigned_to && assigned_to !== '') ? assigned_to : null, date_assigned || null,
        description || null, finalStatusId,
        warranty_start_date || null, warranty_months ? parseInt(warranty_months) : null,
        warranty_end_date || null, id, cep_brc
      ]);

      if (result.rowCount === 0) {
        throw new Error('No rows were updated - item not found');
      }

      await db.query('COMMIT');

      // Log status change AFTER commit if status actually changed
      if (finalStatusId && parseInt(finalStatusId) !== parseInt(currentItem.status_id)) {
        try {
          const [oldStatusResult, newStatusResult] = await Promise.all([
            db.query('SELECT name FROM statuses WHERE id = $1', [currentItem.status_id]),
            db.query('SELECT name FROM statuses WHERE id = $1', [finalStatusId])
          ]);

          const oldStatusName = oldStatusResult.rows[0]?.name || 'Unknown';
          const newStatusName = newStatusResult.rows[0]?.name || 'Unknown';

          let changeReason = 'Manual status update';
          if (parseInt(finalStatusId) !== parseInt(status_id)) {
            changeReason = 'Auto-updated due to assignment change';
          }

          await historyLogger.logItemHistory(
            id,
            'status_changed',
            {
              field: 'status',
              from: currentItem.status_id,
              to: finalStatusId,
              from_name: oldStatusName,
              to_name: newStatusName,
              reason: changeReason,
              changed_by_user: req.session.user.name
            },
            req.session.user.id
          );

          console.log(`🔄 Status changed for item ${id}: ${oldStatusName} → ${newStatusName} (${changeReason})`);
        } catch (historyError) {
          console.error('❌ Error logging history (item updated successfully):', historyError);
        }
      }

      console.log('Item updated successfully');
      res.redirect(`/items/${id}/${cep_brc}?updated=true`);

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).render('error', { error: 'Failed to update item' });
  }
};

// Update the showEditItemForm method
exports.showEditItemForm = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    const itemResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name, s.supplier, s.date_acquired,
             st.name as status_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (itemResult.rows.length === 0) {
      return res.status(404).render('error', { error: 'Item not found' });
    }

    // Get reference data
    const types = await db.query('SELECT * FROM types ORDER BY name');
    const brands = await db.query('SELECT * FROM brands ORDER BY name');
    const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');
    const statuses = await db.query('SELECT id, name, description, icon, color, is_active FROM statuses ORDER BY status_order ASC, name ASC');

    res.render('layout', {
      title: 'Edit Asset',
      body: 'items/edit',
      item: itemResult.rows[0],
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      statuses: statuses.rows,
      formData: undefined, // Explicitly set to undefined to prevent errors
      user: req.session.user
    });

  } catch (error) {
    console.error('Error fetching item for edit:', error);
    res.status(500).render('error', { error: 'Failed to load item for editing' });
  }
};

exports.getItemHistory = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 20;

    // Get the item details
    const itemResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (itemResult.rows.length === 0) {
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      req.flash('error', 'Item not found');
      return res.redirect('/items');
    }

    const item = itemResult.rows[0];

    // Get all history entries for this item
    const allHistoryResult = await db.query(`
      SELECT ih.*, u.name as performed_by_name, u.name as user_name
      FROM item_history ih
      LEFT JOIN users u ON ih.performed_by = u.id
      WHERE ih.item_id = $1
      ORDER BY ih.created_at DESC
    `, [id]);

    // Process all history data
    const processedAllHistory = allHistoryResult.rows.map(entry => ({
      ...entry,
      action_details: typeof entry.action_details === 'string'
        ? JSON.parse(entry.action_details)
        : entry.action_details
    }));

    const totalItems = processedAllHistory.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalItems);

    // Paginate in-memory
    const paginatedHistory = processedAllHistory.slice(startIndex, endIndex);

    // Get all users for the filter dropdown
    const usersResult = await db.query('SELECT id, name FROM users ORDER BY name');
    const users = usersResult.rows;

    res.cookie('historyPerPage', perPage, { maxAge: 3600000 }); // 1 hour

    res.render('layout', {
      title: `Asset History - ${item.cep_brc}`,
      body: 'items/history',
      item,
      history: processedAllHistory,
      paginatedHistory,
      users,
      currentPage: page,
      totalPages,
      itemsPerPage: perPage,
      totalItems,
      startIndex,
      endIndex,
      messages: req.flash(),
      user: req.session.user
    });

  } catch (error) {
    console.error('Error fetching item history:', error);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(500).json({
        success: false,
        error: 'Failed to load item history'
      });
    }
    req.flash('error', 'Error loading item history');
    res.redirect('/items');
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get item details before deletion for logging
    const itemResult = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name, e.cep as employee_cep
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    if (itemResult.rows.length === 0) {
      req.flash('error', 'Item not found');
      return res.redirect('/items');
    }

    const item = itemResult.rows[0];

    // Start transaction
    await db.query('BEGIN');

    try {
      // If item is assigned, unassign it first
      if (item.assigned_to) {
        await db.query(
          'UPDATE items SET assigned_to = NULL, date_assigned = NULL WHERE id = $1 AND cep_brc = $2',
          [id, cep_brc]
        );

        // Log unassignment due to deletion
        await historyLogger.logItemHistory(
          id,
          'unassigned',
          {
            employee_id: item.assigned_to,
            employee_name: item.assigned_to_name,
            employee_cep: item.employee_cep,
            reason: 'Item deleted'
          },
          req.session.user.id
        );
      }

      // Log deletion
      await historyLogger.logItemHistory(
        id,
        'deleted',
        {
          item_name: item.name,
          item_id: item.cep_brc,
          type: item.type_name,
          brand: item.brand_name,
          was_assigned_to: item.assigned_to_name,
          deleted_by: req.session.user.name
        },
        req.session.user.id
      );

      // Delete the item
      await db.query('DELETE FROM items WHERE id = $1 AND cep_brc = $2', [id, cep_brc]);

      await db.query('COMMIT');

      req.flash('success', `Asset "${item.name}" (${item.cep_brc}) deleted successfully`);
      res.redirect('/items');

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting item:', error);
    req.flash('error', 'Failed to delete item: ' + error.message);
    res.redirect('/items');
  }
};

// Search items API endpoint
exports.searchItems = async (req, res) => {
  try {
    const { q: searchTerm, type, brand, status, department, minPrice, maxPrice, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const perPage = getItemsPerPage(req);
    const offset = (page - 1) * perPage;

    // Build the query conditions
    let conditions = ['1=1']; // Base condition
    let params = [];
    let paramCount = 1;

    // Search term filter - focus on asset ID, name, and assigned employee
    if (searchTerm && searchTerm.trim()) {
      conditions.push(`(
        LOWER(i.name) LIKE LOWER($${paramCount}) OR
        LOWER(i.cep_brc) LIKE LOWER($${paramCount + 1}) OR
        LOWER(e.name) LIKE LOWER($${paramCount + 2})
      )`);
      const searchPattern = `%${searchTerm.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 3;
    }

    // Type filter
    if (type) {
      conditions.push(`i.type_id = $${paramCount++}`);
      params.push(type);
    }

    // Brand filter
    if (brand) {
      conditions.push(`i.brand_id = $${paramCount++}`);
      params.push(brand);
    }

    // Status filter
    if (status) {
      conditions.push(`i.status_id = $${paramCount++}`);
      params.push(status);
    }

    // Department filter
    if (department) {
      conditions.push(`e.dept_id = $${paramCount++}`);
      params.push(department);
    }

    // Price range filters
    const minPriceNum = minPrice ? parseFloat(minPrice) : null;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;

    if (minPriceNum !== null && !isNaN(minPriceNum)) {
      conditions.push(`i.price >= $${paramCount++}`);
      params.push(minPriceNum);
    }

    if (maxPriceNum !== null && !isNaN(maxPriceNum)) {
      conditions.push(`i.price <= $${paramCount++}`);
      params.push(maxPriceNum);
    }

    // Date range filters
    if (startDate) {
      conditions.push(`s.date_acquired >= $${paramCount++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`s.date_acquired <= $${paramCount++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 1 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total items
    const countQuery = `
      SELECT COUNT(*) as total
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN statuses st ON i.status_id = st.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].total);

    // Get items with pagination
    const itemsQuery = `
      SELECT i.id, i.cep_brc, i.name, i.type_id, i.brand_id, i.model, i.serial_cod,
             i.price, i.assigned_to, i.date_assigned, s.date_acquired,
             i.description, i.status_id, i.warranty_start_date, i.warranty_months,
             i.warranty_end_date, i.created_at, i.updated_at,
             t.name as type_name, b.name as brand_name, e.name as assigned_to_name,
             e.cep as employee_cep, d.name as dept_name, st.name as status_name,
             st.color as status_color, st.icon as status_icon
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN statuses st ON i.status_id = st.id
      LEFT JOIN sales s ON i.receipt = s.receipt
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(perPage, offset);
    const itemsResult = await db.query(itemsQuery, params);

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / perPage);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Return JSON response
    res.json({
      success: true,
      items: itemsResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        perPage,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null
      },
      filters: {
        searchTerm,
        type,
        brand,
        status,
        department,
        minPrice,
        maxPrice,
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Error searching items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search items',
      message: error.message
    });
  }
};

// Bulk asset creation methods
exports.bulkCreateForm = async (req, res) => {
  try {
    // Get reference data for the form
    const types = await db.query('SELECT * FROM types ORDER BY name');
    const brands = await db.query('SELECT * FROM brands ORDER BY name');

    res.render('layout', {
      title: 'Bulk Create Assets',
      body: 'items/bulk-create',
      types: types.rows,
      brands: brands.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching data for bulk create form:', error);
    res.status(500).send('Server error');
  }
};

exports.bulkCreateAssets = async (req, res) => {
  try {
    const {
      base_name, type_id, brand_id, model, price, description,
      cexpt_ids, serial_numbers
    } = req.body;

    console.log('Bulk creating assets with data:', {
      base_name, type_id, brand_id, model, price, description,
      cexpt_ids, serial_numbers
    });

    // Validation
    const errors = [];

    if (!base_name || base_name.trim() === '') {
      errors.push('Base asset name is required');
    }

    if (!type_id) {
      errors.push('Asset type is required');
    }

    if (!cexpt_ids || !Array.isArray(cexpt_ids) || cexpt_ids.length === 0) {
      errors.push('At least one CEXPT ID is required');
    }

    if (!serial_numbers || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      errors.push('At least one serial number is required');
    }

    if (cexpt_ids && serial_numbers && cexpt_ids.length !== serial_numbers.length) {
      errors.push('Number of CEXPT IDs and serial numbers must match');
    }

    // Check for empty values
    if (cexpt_ids) {
      const emptyCexptIds = cexpt_ids.some(id => !id || id.trim() === '' || id.trim() === 'CEXPT');
      if (emptyCexptIds) {
        errors.push('All CEXPT IDs must be filled in with a value after "CEXPT"');
      }

      // Check for minimum length (CEXPT + something)
      const shortCexptIds = cexpt_ids.filter(id => id && id.trim().length < 6);
      if (shortCexptIds.length > 0) {
        errors.push('CEXPT IDs must be at least 6 characters long');
      }
    }

    if (serial_numbers) {
      const emptySerials = serial_numbers.some(sn => !sn || sn.trim() === '');
      if (emptySerials) {
        errors.push('All serial numbers must be filled in');
      }
    }

    // Check for duplicates within the submitted data
    if (cexpt_ids) {
      const uniqueCexptIds = [...new Set(cexpt_ids.filter(id => id && id.trim() !== ''))];
      if (uniqueCexptIds.length !== cexpt_ids.filter(id => id && id.trim() !== '').length) {
        errors.push('Duplicate CEXPT IDs found in submission');
      }
    }

    if (serial_numbers) {
      const uniqueSerials = [...new Set(serial_numbers.filter(sn => sn && sn.trim() !== ''))];
      if (uniqueSerials.length !== serial_numbers.filter(sn => sn && sn.trim() !== '').length) {
        errors.push('Duplicate serial numbers found in submission');
      }
    }

    if (errors.length > 0) {
      console.log('Bulk create validation errors:', errors);

      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');

      return res.render('layout', {
        title: 'Bulk Create Assets',
        body: 'items/bulk-create',
        types: types.rows,
        brands: brands.rows,
        errors: errors,
        formData: req.body,
        user: req.session.user
      });
    }

    // Get the "New" or "NEW" status ID from database
    const newStatusResult = await db.query("SELECT id FROM statuses WHERE LOWER(name) IN ('new', 'novo') LIMIT 1");
    let status_id = 1; // Default fallback
    if (newStatusResult.rows.length > 0) {
      status_id = newStatusResult.rows[0].id;
    } else {
      // If no "New" status exists, try to create one
      try {
        const createStatusResult = await db.query(`
          INSERT INTO statuses (name, color, icon, description)
          VALUES ('New', 'blue', 'fas fa-plus-circle', 'Newly created asset')
          RETURNING id
        `);
        status_id = createStatusResult.rows[0].id;
      } catch (createError) {
        console.error('Could not create New status:', createError);
        // Keep default fallback
      }
    }

    // Check for existing CEXPT IDs and serial numbers in database
    const existingCexptIds = [];
    const existingSerials = [];

    for (let cexpt_id of cexpt_ids) {
      if (cexpt_id && cexpt_id.trim() !== '') {
        const existingItem = await db.query('SELECT cep_brc FROM items WHERE LOWER(cep_brc) = LOWER($1)', [cexpt_id.trim()]);
        if (existingItem.rows.length > 0) {
          existingCexptIds.push(cexpt_id.trim());
        }
      }
    }

    for (let serial of serial_numbers) {
      if (serial && serial.trim() !== '') {
        const existingItem = await db.query('SELECT serial_cod FROM items WHERE LOWER(serial_cod) = LOWER($1)', [serial.trim()]);
        if (existingItem.rows.length > 0) {
          existingSerials.push(serial.trim());
        }
      }
    }

    if (existingCexptIds.length > 0 || existingSerials.length > 0) {
      const duplicateErrors = [];
      if (existingCexptIds.length > 0) {
        duplicateErrors.push(`CEXPT IDs already exist: ${existingCexptIds.join(', ')}`);
      }
      if (existingSerials.length > 0) {
        duplicateErrors.push(`Serial numbers already exist: ${existingSerials.join(', ')}`);
      }

      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');

      return res.render('layout', {
        title: 'Bulk Create Assets',
        body: 'items/bulk-create',
        types: types.rows,
        brands: brands.rows,
        errors: duplicateErrors,
        formData: req.body,
        user: req.session.user
      });
    }

    // Create all assets
    const createdAssets = [];
    let successCount = 0;
    const errorMessages = [];

    for (let i = 0; i < cexpt_ids.length; i++) {
      const cexpt_id = cexpt_ids[i].trim();
      const serial_number = serial_numbers[i].trim();

      if (!cexpt_id || !serial_number) continue;

      try {
        const result = await db.query(`
          INSERT INTO items (
            cep_brc, name, type_id, price, brand_id, model, serial_cod,
            description, status_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING id, cep_brc
        `, [
          cexpt_id,
          base_name.trim(),
          type_id,
          price ? parseFloat(price) : null,
          brand_id || null,
          model || null,
          serial_number,
          description || null,
          status_id
        ]);

        const newAsset = result.rows[0];
        createdAssets.push(newAsset);
        successCount++;

        // Log the creation in history
        try {
          await historyLogger.logItemHistory(
            newAsset.id,
            'created',
            {
              name: base_name.trim(),
              type_id: type_id,
              status_id: status_id,
              cep_brc: cexpt_id,
              serial_cod: serial_number,
              bulk_created: true
            },
            req.session.user.id
          );
        } catch (historyError) {
          console.error('Failed to log history for asset', newAsset.id, ':', historyError);
        }

      } catch (createError) {
        console.error(`Error creating asset ${cexpt_id}:`, createError);
        errorMessages.push(`Failed to create asset ${cexpt_id}: ${createError.message}`);
      }
    }

    if (successCount > 0 && errorMessages.length === 0) {
      console.log(`Successfully created ${successCount} assets`);
      req.flash('success', `Successfully created ${successCount} assets`);
      res.redirect('/items');
    } else if (successCount > 0 && errorMessages.length > 0) {
      console.log(`Created ${successCount} assets with ${errorMessages.length} errors`);
      req.flash('success', `Successfully created ${successCount} assets`);
      req.flash('error', `Some assets failed to create: ${errorMessages.join(', ')}`);
      res.redirect('/items');
    } else {
      console.log('Failed to create any assets');

      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');

      return res.render('layout', {
        title: 'Bulk Create Assets',
        body: 'items/bulk-create',
        types: types.rows,
        brands: brands.rows,
        errors: ['Failed to create any assets'].concat(errorMessages),
        formData: req.body,
        user: req.session.user
      });
    }

  } catch (error) {
    console.error('Error in bulk create assets:', error);
    res.status(500).send('Server error during bulk asset creation');
  }
};


