const db = require('../config/db');

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

exports.getAllItems = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*, t.name as type_name, b.name as brand_name,
             e.name as assigned_to_name
      FROM items i
      LEFT JOIN types t ON i.type_id = t.id
      LEFT JOIN brands b ON i.brand_id = b.id
      LEFT JOIN employees e ON i.assigned_to = e.id
      ORDER BY i.created_at DESC
    `);

    // Convert price strings to numbers for toFixed to work
    const items = result.rows.map(item => ({
      ...item,
      price: item.price ? parseFloat(item.price) : 0
    }));

    res.render('layout', {
      title: 'Inventory Items',
      body: 'items/index',
      items: items,
      user: req.session.user
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
      model, serial_cod, receipt, date_assigned, assigned_to
    } = req.body;

    // Validate input data
    const validationErrors = validateItemData(req.body);

    if (validationErrors.length > 0) {
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

    const result = await db.query(`
      INSERT INTO items
      (cep_brc, name, type_id, price, brand_id, model, serial_cod, receipt, date_assigned, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, cep_brc
    `, [
      cep_brc, name, type_id, price || null, brand_id || null,
      model || null, serial_cod || null, receipt || null,
      date_assigned || null, assigned_to || null
    ]);

    res.redirect(`/items/${result.rows[0].id}/${result.rows[0].cep_brc}`);
  } catch (error) {
    console.error('Error creating item:', error);

    // Handle specific database errors
    if (error.code === '23505') {
      return res.status(400).send('An item with this ID or serial number already exists');
    }

    res.status(500).send('Server error');
  }
};

exports.updateItemForm = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    // Get item data
    const itemResult = await db.query(
      'SELECT * FROM items WHERE id = $1 AND cep_brc = $2',
      [id, cep_brc]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).send('Item not found');
    }

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
      model, serial_cod, receipt, date_assigned, assigned_to
    } = req.body;

    // Get the submitted CEP/BRC (which may be different if admin changed it)
    const new_cep_brc = req.body.cep_brc;

    // Check if the user is admin before allowing ID change
    const isAdmin = req.session.user && req.session.user.role === 'admin';
    const idChanged = new_cep_brc !== cep_brc;

    if (idChanged && !isAdmin) {
      return res.status(403).send('Only administrators can change Item IDs');
    }

    // Validate input data
    const validationErrors = validateItemData(req.body);

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
            receipt, date_assigned, assigned_to, created_at, updated_at
          )
          SELECT
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, created_at, NOW()
          FROM items
          WHERE id = $12 AND cep_brc = $13
        `, [
          id, new_cep_brc, name, type_id, price || null, brand_id || null,
          model || null, serial_cod || null, receipt || null,
          date_assigned || null, assigned_to || null, id, cep_brc
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
        updated_at = NOW()
      WHERE id = $10 AND cep_brc = $11
    `, [
      name, type_id, price || null, brand_id || null, model || null,
      serial_cod || null, receipt || null, date_assigned || null,
      assigned_to || null, id, cep_brc
    ]);

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

    // Get employees for dropdown
    const employees = await db.query('SELECT * FROM employees WHERE left_date IS NULL ORDER BY name');

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

exports.assignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;
    const { assigned_to, date_assigned } = req.body;

    await db.query(`
      UPDATE items SET
        assigned_to = $1,
        date_assigned = $2,
        updated_at = NOW()
      WHERE id = $3 AND cep_brc = $4
    `, [assigned_to, date_assigned, id, cep_brc]);

    res.redirect(`/items/${id}/${cep_brc}`);
  } catch (error) {
    console.error('Error assigning item:', error);
    res.status(500).send('Server error');
  }
};

exports.unassignItem = async (req, res) => {
  try {
    const { id, cep_brc } = req.params;

    await db.query(`
      UPDATE items SET
        assigned_to = NULL,
        date_assigned = NULL,
        updated_at = NOW()
      WHERE id = $1 AND cep_brc = $2
    `, [id, cep_brc]);

    res.redirect(`/items/${id}/${cep_brc}`);
  } catch (error) {
    console.error('Error unassigning item:', error);
    res.status(500).send('Server error');
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
