const db = require('../config/db');
const historyLogger = require('../utils/historyLogger');

const validateItemData = (data, isEdit = false) => {
  const errors = [];

  console.log('🔍 Validating item data:', { data, isEdit });

  if (!data.cep_brc || data.cep_brc.trim() === '') {
    errors.push('Item ID (CEP/BRC) is required');
  }

  if (!data.name || data.name.trim() === '') {
    errors.push('Item name is required');
  }

  if (!data.type_id || data.type_id === '') {
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

  if (errors.length > 0) {
    console.log('❌ Validation errors found:', errors);
  } else {
    console.log('✅ Validation passed');
  }

  return errors;
};

exports.getAllItems = async (req, res) => {
  try {
    // Parse query parameters for filtering
    const typeFilter = req.query.type || '';
    const assignmentFilter = req.query.assigned || '';
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Build the query conditions
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (typeFilter) {
      conditions.push(`i.type_id = $${paramCount++}`);
      params.push(typeFilter);
    }

    if (assignmentFilter === 'assigned') {
      conditions.push(`i.assigned_to IS NOT NULL`);
    } else if (assignmentFilter === 'unassigned') {
      conditions.push(`i.assigned_to IS NULL`);
    }

    // Create the WHERE clause if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching items for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM items i
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / perPage);

    // Get the filtered items with pagination
    const itemsQuery = `
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name, d.name as department_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
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

    // Convert price strings to numbers for toFixed to work
    const items = itemsResult.rows.map(item => ({
      ...item,
      price: item.price ? parseFloat(item.price) : 0
    }));

    res.render('layout', {
      title: 'Inventory Items',
      body: 'items/index',
      items: items,
      types: typesResult.rows,
      brands: brandsResult.rows,
      departments: departmentsResult.rows,
      selectedType: typeFilter,
      assignmentFilter: assignmentFilter,
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      perPage: perPage,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};

// Update this method to handle the composite key
exports.getItemById = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    const result = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
       e.name as assigned_to_name, e.id as employee_id,
       s.supplier, s.date_acquired
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      LEFT JOIN sales s ON i.receipt = s.receipt
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
    ,
      query: req.query,
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

    res.render('layout', {
      title: 'Add New Item',
      body: 'items/create',
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching data for item form:', error);
    res.status(500).send('Server error');
  }
};

exports.createItem = async (req, res) => {
  try {
    const {
      cep_brc, name, type_id, price, brand_id,
      model, serial_cod, receipt, date_assigned, assigned_to, description
    } = req.body;

    console.log('Creating new item with data:', {
      cep_brc, name, type_id, price, brand_id,
      model, serial_cod, receipt, date_assigned, assigned_to
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
      ,
      query: req.query,
      });
    }

    // Insert the new item
    try {
      const result = await db.query(`
        INSERT INTO items
        (cep_brc, name, type_id, price, brand_id, model, serial_cod, receipt, date_assigned, assigned_to, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, cep_brc
      `, [
        cep_brc, name, type_id, price || null, brand_id || null,
        model || null, serial_cod || null, receipt || null,
        date_assigned || null, assigned_to || null, description || null
      ]);

      console.log('Item created successfully:', result.rows[0]);

      // After successfully creating the item, log the history
      try {
        await historyLogger.logItemHistory(
          result.rows[0].id,
          'created',
          {
            cep_brc: req.body.cep_brc,
            name: req.body.name,
            type_id: req.body.type_id,
            description: req.body.description
          },
          req.session.user.id
        );
        console.log('History logged for new item');
      } catch (historyError) {
        console.error('Error logging item history, but item was created:', historyError);
        // Continue with redirect even if history logging fails
      }

      return res.redirect(`/items/${result.rows[0].id}/${result.rows[0].cep_brc}`);
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

    console.log('📝 Loading edit form for item:', { id, cep_brc });

    // Get item data
    const itemResult = await db.query(
      'SELECT * FROM items WHERE id = $1 AND cep_brc = $2',
      [id, cep_brc]
    );

    if (itemResult.rows.length === 0) {
      console.log('❌ Item not found:', { id, cep_brc });
      return res.status(404).send('Item not found');
    }

    console.log('📊 Item data loaded:', itemResult.rows[0]);

    // Get types for dropdown
    const types = await db.query('SELECT * FROM types ORDER BY name');

    // Get brands for dropdown
    const brands = await db.query('SELECT * FROM brands ORDER BY name');

    // Get sales receipts for dropdown
    const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');

    // Get employees for dropdown
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');

    res.render('layout', {
      title: 'Edit Item',
      body: 'items/edit',
      item: itemResult.rows[0],
      types: types.rows,
      brands: brands.rows,
      sales: sales.rows,
      employees: employees.rows,
      user: req.session.user
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error fetching item for edit:', error);
    res.status(500).send('Server error');
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    const {
      name, type_id, price, brand_id,
      model, serial_cod, receipt, date_assigned, assigned_to, description
    } = req.body;

    // Get the submitted CEP/BRC (which may be different if admin changed it)
    const new_cep_brc = req.body.cep_brc;

    // Check if the user is admin before allowing ID change
    const isAdmin = req.session.user && req.session.user.role === 'admin';
    const idChanged = new_cep_brc !== cep_brc;

    if (idChanged && !isAdmin) {
      return res.status(403).send('Only administrators can change Item IDs');
    }

    // Validate input data for editing
    const validationErrors = validateItemData(req.body, true);
    
    console.log('📝 Editing item with data:', {
      id, cep_brc, 
      formData: req.body,
      validationErrors
    });

    if (validationErrors.length > 0) {
      // Get reference data for the form
      const types = await db.query('SELECT * FROM types ORDER BY name');
      const brands = await db.query('SELECT * FROM brands ORDER BY name');
      const sales = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');
      const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');

      return res.render('layout', {
        title: 'Edit Item',
        body: 'items/edit',
        item: { ...req.body, id, cep_brc },
        types: types.rows,
        brands: brands.rows,
        sales: sales.rows,
        employees: employees.rows,
        errors: validationErrors,
        user: req.session.user
      });
    }

    // Use a transaction when changing the ID
    let client = null;

    if (idChanged) {
      client = await db.getClient();
      try {
        await client.query('BEGIN');

        // 1. Create a new record with the new ID
        await client.query(`
          INSERT INTO items (
            id, cep_brc, name, type_id, price, brand_id, model, serial_cod,
            receipt, date_assigned, assigned_to, description, created_at, updated_at
          )
          SELECT
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, created_at, NOW()
          FROM items
          WHERE id = $13 AND cep_brc = $14
        `, [
          id, new_cep_brc, name, type_id, price || null, brand_id || null,
          model || null, serial_cod || null, receipt || null,
          date_assigned || null, assigned_to || null, description || null, id, cep_brc
        ]);

        // 2. Delete the old record
        await client.query('DELETE FROM items WHERE id = $1 AND cep_brc = $2', [id, cep_brc]);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return res.redirect(`/items/${id}/${new_cep_brc}`);
    }

    // Normal update (no ID change)
    await db.query(`
      UPDATE items SET
        name = $1,
        type_id = $2,
        price = $3,
        brand_id = $4,
        model = $5,
        serial_cod = $6,
        receipt = $7,
        date_assigned = $8,
        assigned_to = $9,
        description = $10,
        updated_at = NOW()
      WHERE id = $11 AND cep_brc = $12
    `, [
      name, type_id, price || null, brand_id || null, model || null,
      serial_cod || null, receipt || null, date_assigned || null,
      assigned_to || null, description || null, id, cep_brc
    ]);

    // Get original item data for comparison
    const originalItem = await db.query('SELECT * FROM items WHERE id = $1', [req.params.id]);

    // Log what has changed
    const changes = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (originalItem.rows[0][key] != value) {
        changes[key] = {
          from: originalItem.rows[0][key],
          to: value
        };
      }
    }

    if (Object.keys(changes).length > 0) {
      await historyLogger.logItemHistory(
        req.params.id,
        'updated',
        changes,
        req.session.user.id
      );
    }

    res.redirect(`/items/${id}/${cep_brc}`);
  } catch (error) {
    console.error('Error updating item:', error);

    // Handle specific errors
    if (error.code === '23505') {
      return res.status(400).send('An item with this ID already exists');
    }

    res.status(500).send('Server error: ' + error.message);
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    await db.query('DELETE FROM items WHERE id = $1 AND cep_brc = $2', [id, cep_brc]);

    res.redirect('/items');
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).send('Server error');
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
    ,
      query: req.query,
      });
  } catch (error) {
    console.error('Error loading assignment form:', error);
    res.status(500).send('Server error');
  }
};

exports.assignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    console.log('Assign item request:', {
      id,
      cep_brc,
      body: req.body,
      isAjax: req.isAjax
    });

    const { assigned_to, date_assigned } = req.body;

    // Validate the input
    if (!assigned_to || !date_assigned) {
      const error = 'Both employee and assignment date are required';
      console.error(error, { assigned_to, date_assigned });

      if (req.isAjax) {
        return res.status(400).json({ error });
      }
      return res.status(400).send(error);
    }

    // Perform the update
    const updateResult = await db.query(`
      UPDATE items SET
        assigned_to = $1,
        date_assigned = $2,
        updated_at = NOW()
      WHERE id = $3 AND cep_brc = $4
      RETURNING *
    `, [assigned_to, date_assigned, id, cep_brc]);

    if (updateResult.rows.length === 0) {
      const error = 'Item not found or could not be updated';
      console.error(error);

      if (req.isAjax) {
        return res.status(404).json({ error });
      }
      return res.status(404).send(error);
    }

    try {
      // Get employee name for the history record
      const employeeResult = await db.query('SELECT name, cep FROM employees WHERE id = $1', [assigned_to]);
      const employeeName = employeeResult.rows[0]?.name || 'Unknown';
      const employeeCep = employeeResult.rows[0]?.cep || 'Unknown';

      // Log the assignment in history - catch any errors here to prevent breaking the main flow
      try {
        await historyLogger.logItemHistory(
          id,
          'assigned',
          {
            employee_id: assigned_to,
            employee_name: employeeName,
            employee_cep: employeeCep,
            date: date_assigned
          },
          req.session.user.id
        );
      } catch (historyError) {
        console.error('Failed to log history, but assignment was successful:', historyError);
      }
    } catch (lookupError) {
      console.error('Error getting employee details:', lookupError);
      // Continue with redirection even if employee details couldn't be fetched
    }

    if (req.isAjax) {
      return res.json({
        success: true,
        redirect: `/items/${id}/${cep_brc}`
      });
    }

    return res.redirect(`/items/${id}/${cep_brc}`);
  } catch (error) {
    console.error('Error assigning item:', error);

    if (req.isAjax) {
      return res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }

    res.status(500).send('Server error: ' + error.message);
  }
};

exports.unassignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get current assignment info for history
    const itemResult = await db.query(`
      SELECT i.assigned_to, e.name as employee_name, e.cep as employee_cep
      FROM items i
      LEFT JOIN employees e ON i.assigned_to = e.id
      WHERE i.id = $1 AND i.cep_brc = $2
    `, [id, cep_brc]);

    const item = itemResult.rows[0];

    await db.query(`
      UPDATE items SET
        assigned_to = NULL,
        date_assigned = NULL,
        updated_at = NOW()
      WHERE id = $1 AND cep_brc = $2
    `, [id, cep_brc]);

    // Log the unassignment in history - catch any errors to prevent breaking the main flow
    if (item && item.assigned_to) {
      try {
        await historyLogger.logItemHistory(
          id,
          'unassigned',
          {
            employee_id: item.assigned_to,
            employee_name: item.employee_name || 'Unknown',
            employee_cep: item.employee_cep || 'Unknown'
          },
          req.session.user.id
        );
      } catch (historyError) {
        console.error('Failed to log history, but unassignment was successful:', historyError);
      }
    }

    return res.redirect(`/items/${id}/${cep_brc}`);
  } catch (error) {
    console.error('Error unassigning item:', error);
    res.status(500).send('Server error: ' + error.message);
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
    ,
      query: req.query,
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

// Make sure action_details is properly handled as JSONB
exports.getItemHistory = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get the item details
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

    // Get the history for this item
    const historyResult = await db.query(`
      SELECT h.*, u.name as user_name
      FROM item_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.item_id = $1
      ORDER BY h.created_at DESC
    `, [id]);

    // Process history data to ensure action_details is parsed JSON
    const processedHistory = historyResult.rows.map(entry => {
      return {
        ...entry,
        action_details: typeof entry.action_details === 'string'
          ? JSON.parse(entry.action_details)
          : entry.action_details
      };
    });

    // Helper functions for the template
    const formatActionType = (type) => {
      const types = {
        'created': 'Created',
        'updated': 'Updated',
        'assigned': 'Assigned',
        'unassigned': 'Unassigned'
      };
      return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
    };

    const formatFieldName = (field) => {
      const fields = {
        'cep_brc': 'Item ID',
        'name': 'Name',
        'type_id': 'Type',
        'brand_id': 'Brand',
        'model': 'Model',
        'serial_cod': 'Serial Number',
        'price': 'Price',
        'receipt': 'Receipt',
        'assigned_to': 'Assigned To',
        'date_assigned': 'Date Assigned'
      };
      return fields[field] || field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
    };

    const formatFieldValue = (value) => {
      if (value === null || value === undefined) return 'None';
      if (value instanceof Date) return value.toLocaleDateString();
      return value;
    };

    // Add pagination variables
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 20;

    res.render('layout', {
      title: `History: ${itemResult.rows[0].name}`,
      body: 'items/history',
      item: itemResult.rows[0],
      history: processedHistory,
      page: currentPage,        // Add this
      perPage: itemsPerPage,    // Add this
      formatActionType,
      formatFieldName,
      formatFieldValue,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching item history:', error);
    res.status(500).send('Server error: ' + error.message);
  }
};
