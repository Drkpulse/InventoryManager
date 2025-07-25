const db = require('../config/db');

const validatePrinterData = (data) => {
  const errors = [];

  if (!data.supplier || data.supplier.trim() === '') {
    errors.push('Supplier is required');
  }

  // Client is optional - removed client_id requirement

  if (!data.status_id) {
    errors.push('Status is required');
  }

  if (data.cost && isNaN(parseFloat(data.cost))) {
    errors.push('Cost must be a valid number');
  }

  return errors;
};

exports.getAllPrinters = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Parse query parameters for filtering
    const clientFilter = req.query.client || '';
    const employeeFilter = req.query.employee || '';

    // Build the query conditions
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (clientFilter) {
      conditions.push(`p.client_id = $${paramCount++}`);
      params.push(clientFilter);
    }

    if (employeeFilter === 'assigned') {
      conditions.push(`p.employee_id IS NOT NULL`);
    } else if (employeeFilter === 'unassigned') {
      conditions.push(`p.employee_id IS NULL`);
    }

    // Create the WHERE clause if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching printers for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM printers p
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalPrinters = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPrinters / perPage);

    // Get the filtered printers with pagination
    const printersQuery = `
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code,
             e.name as employee_name,
             s.name as status_name
      FROM printers p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN employees e ON p.employee_id = e.id
      LEFT JOIN statuses s ON p.status_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const printersResult = await db.query(printersQuery, params);

    // Get all clients for filter dropdown
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');

    res.render('layout', {
      title: 'Printer Management',
      body: 'printers/index',
      printers: printersResult.rows,
      clients: clientsResult.rows,
      currentPage: page,
      totalPages: totalPages,
      totalPrinters: totalPrinters,
      filters: {
        client: clientFilter,
        employee: employeeFilter
      },
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching printers:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch printers',
      user: req.user 
    });
  }
};

exports.getPrinterById = async (req, res) => {
  try {
    const { id } = req.params;

    const printerResult = await db.query(`
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code,
             e.name as employee_name,
             s.name as status_name
      FROM printers p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN employees e ON p.employee_id = e.id
      LEFT JOIN statuses s ON p.status_id = s.id
      WHERE p.id = $1
    `, [id]);

    if (printerResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Printer not found',
        user: req.user 
      });
    }

    res.render('layout', {
      title: `Printer #${id}`,
      body: 'printers/show',
      printer: printerResult.rows[0],
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching printer:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch printer details',
      user: req.user 
    });
  }
};

exports.createPrinterForm = async (req, res) => {
  try {
    console.log('🖨️ Loading printer create form', {
      query: req.query
    });

    // Get all clients, employees, and statuses for dropdowns
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

    res.render('layout', {
      title: 'Add New Printer',
      body: 'printers/create',
      clients: clientsResult.rows,
      employees: employeesResult.rows,
      statuses: statusesResult.rows,
      query: req.query,
      user: req.session.user || req.user
    });
  } catch (error) {
    console.error('Error rendering create form:', error);
    res.status(500).render('error', { 
      error: 'Failed to load create form',
      user: req.user 
    });
  }
};

exports.createPrinter = async (req, res) => {
  try {
    const { supplier, model, employee_id, client_id, cost, status_id } = req.body;
    
    const validationErrors = validatePrinterData({ supplier, client_id, status_id, cost });
    if (validationErrors.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      
      return res.status(400).render('layout', {
        title: 'Add New Printer',
        body: 'printers/create',
        errors: validationErrors,
        formData: req.body,
        clients: clientsResult.rows,
        employees: employeesResult.rows,
        statuses: statusesResult.rows,
        user: req.user
      });
    }

    const result = await db.query(`
      INSERT INTO printers (supplier, model, employee_id, client_id, cost, status_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [supplier, model, employee_id || null, client_id || null, cost || null, status_id]);

    const newPrinter = result.rows[0];

    // Log history
    await logPrinterHistory(newPrinter.id, 'created', {
      supplier: supplier,
      model: model,
      employee_id: employee_id || null,
      client_id: client_id,
      cost: cost || null,
      status_id: status_id
    }, (req.user || req.session.user).id);

    req.flash('success', 'Printer created successfully');
    res.redirect(`/printers/${newPrinter.id}`);
  } catch (error) {
    console.error('Error creating printer:', error);
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');
    
    res.status(500).render('layout', {
      title: 'Add New Printer',
      body: 'printers/create',
      errors: ['Failed to create printer'],
      formData: req.body,
      clients: clientsResult.rows,
      employees: employeesResult.rows,
      user: req.user
    });
  }
};

exports.updatePrinterForm = async (req, res) => {
  try {
    const { id } = req.params;

    const printerResult = await db.query('SELECT * FROM printers WHERE id = $1', [id]);

    if (printerResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Printer not found',
        user: req.user 
      });
    }

    // Get all clients and employees for dropdowns
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');

    res.render('layout', {
      title: `Edit Printer #${id}`,
      body: 'printers/edit',
      printer: printerResult.rows[0],
      clients: clientsResult.rows,
      employees: employeesResult.rows,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching printer for edit:', error);
    res.status(500).render('error', { 
      error: 'Failed to load edit form',
      user: req.user 
    });
  }
};

exports.updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier, employee_id, client_id } = req.body;

    const validationErrors = validatePrinterData({ supplier, client_id });
    if (validationErrors.length > 0) {
      const printerResult = await db.query('SELECT * FROM printers WHERE id = $1', [id]);
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');
      
      return res.status(400).render('layout', {
        title: `Edit Printer #${id}`,
        body: 'printers/edit',
        errors: validationErrors,
        printer: { ...printerResult.rows[0], ...req.body },
        clients: clientsResult.rows,
        employees: employeesResult.rows,
        user: req.user
      });
    }

    // Get current printer data
    const currentResult = await db.query('SELECT * FROM printers WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Printer not found',
        user: req.user 
      });
    }

    const currentPrinter = currentResult.rows[0];

    // Update printer
    const result = await db.query(`
      UPDATE printers 
      SET supplier = $1, employee_id = $2, client_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [supplier, employee_id || null, client_id, id]);

    // Log changes
    const changes = {};
    if (currentPrinter.supplier !== supplier) changes.supplier = { from: currentPrinter.supplier, to: supplier };
    if (currentPrinter.employee_id !== (employee_id || null)) changes.employee_id = { from: currentPrinter.employee_id, to: employee_id || null };
    if (currentPrinter.client_id !== parseInt(client_id)) changes.client_id = { from: currentPrinter.client_id, to: parseInt(client_id) };

    if (Object.keys(changes).length > 0) {
      await logPrinterHistory(id, 'updated', { changes }, req.user.id);
    }

    req.flash('success', 'Printer updated successfully');
    res.redirect(`/printers/${id}`);
  } catch (error) {
    console.error('Error updating printer:', error);
    const printerResult = await db.query('SELECT * FROM printers WHERE id = $1', [req.params.id]);
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const employeesResult = await db.query('SELECT id, name FROM employees ORDER BY name');
    
    res.status(500).render('layout', {
      title: `Edit Printer #${req.params.id}`,
      body: 'printers/edit',
      errors: ['Failed to update printer'],
      printer: printerResult.rows[0] || {},
      clients: clientsResult.rows,
      employees: employeesResult.rows,
      user: req.user
    });
  }
};

exports.deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;

    const printerResult = await db.query('SELECT * FROM printers WHERE id = $1', [id]);
    if (printerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    const printer = printerResult.rows[0];

    await db.query('DELETE FROM printers WHERE id = $1', [id]);

    // Log deletion
    await logPrinterHistory(id, 'deleted', {
      supplier: printer.supplier,
      client_id: printer.client_id
    }, req.user.id);

    req.flash('success', 'Printer deleted successfully');
    res.redirect('/printers');
  } catch (error) {
    console.error('Error deleting printer:', error);
    req.flash('error', 'Failed to delete printer');
    res.redirect('/printers');
  }
};

exports.getPrinterHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const printerResult = await db.query(`
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code
      FROM printers p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = $1
    `, [id]);
    
    if (printerResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Printer not found',
        user: req.user 
      });
    }

    const historyResult = await db.query(`
      SELECT h.*, u.name as performed_by_name
      FROM printer_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.printer_id = $1
      ORDER BY h.created_at DESC
    `, [id]);

    const history = historyResult.rows.map(row => ({
      ...row,
      action_details: typeof row.action_details === 'string'
        ? JSON.parse(row.action_details)
        : row.action_details
    }));

    res.render('layout', {
      title: `Printer History #${id}`,
      body: 'printers/history',
      printer: printerResult.rows[0],
      history: history,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching printer history:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch printer history',
      user: req.user 
    });
  }
};

// Helper function for logging printer history
async function logPrinterHistory(printerId, actionType, actionDetails, performedBy) {
  try {
    await db.query(`
      INSERT INTO printer_history (printer_id, action_type, action_details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [printerId, actionType, JSON.stringify(actionDetails), performedBy]);

    console.log(`Printer history logged: ${actionType} for printer ${printerId}`);
  } catch (error) {
    console.error('Error logging printer history:', error);
    throw error;
  }
}