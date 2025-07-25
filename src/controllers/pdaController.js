const db = require('../config/db');

const validatePDAData = (data) => {
  const errors = [];

  if (!data.serial_number || data.serial_number.trim() === '') {
    errors.push('Serial number is required');
  }

  if (!data.client_id) {
    errors.push('Client is required');
  }

  if (!data.status_id) {
    errors.push('Status is required');
  }

  if (data.cost && isNaN(parseFloat(data.cost))) {
    errors.push('Cost must be a valid number');
  }

  return errors;
};

exports.getAllPDAs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Parse query parameters for filtering
    const clientFilter = req.query.client || '';
    const statusFilter = req.query.status || '';

    // Build the query conditions
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (clientFilter) {
      conditions.push(`p.client_id = $${paramCount++}`);
      params.push(clientFilter);
    }

    if (statusFilter) {
      conditions.push(`p.status_id = $${paramCount++}`);
      params.push(statusFilter);
    }

    // Create the WHERE clause if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching PDAs for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM pdas p
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalPDAs = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPDAs / perPage);

    // Get the filtered PDAs with pagination
    const pdasQuery = `
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code,
             s.name as status_name,
             (SELECT COUNT(*) FROM sim_cards WHERE pda_id = p.id) as sim_count
      FROM pdas p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN statuses s ON p.status_id = s.id
      ${whereClause}
      ORDER BY p.serial_number
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const pdasResult = await db.query(pdasQuery, params);

    // Get all clients and statuses for filter dropdown
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

    res.render('layout', {
      title: 'PDA Management',
      body: 'pdas/index',
      pdas: pdasResult.rows,
      clients: clientsResult.rows,
      statuses: statusesResult.rows,
      currentPage: page,
      totalPages: totalPages,
      totalPDAs: totalPDAs,
      filters: {
        client: clientFilter,
        status: statusFilter
      },
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching PDAs:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch PDAs',
      user: req.user 
    });
  }
};

exports.getPDAById = async (req, res) => {
  try {
    const { id } = req.params;

    const pdaResult = await db.query(`
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code,
             s.name as status_name,
             (SELECT COUNT(*) FROM sim_cards WHERE pda_id = p.id) as sim_count
      FROM pdas p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN statuses s ON p.status_id = s.id
      WHERE p.id = $1
    `, [id]);

    if (pdaResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'PDA not found',
        user: req.user 
      });
    }

    res.render('layout', {
      title: `PDA: ${pdaResult.rows[0].serial_number}`,
      body: 'pdas/show',
      pda: pdaResult.rows[0],
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching PDA:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch PDA details',
      user: req.user 
    });
  }
};

exports.createPDAForm = async (req, res) => {
  try {
    // Get all clients and statuses for dropdown
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

    res.render('layout', {
      title: 'Add New PDA',
      body: 'pdas/create',
      clients: clientsResult.rows,
      statuses: statusesResult.rows,
      user: req.user
    });
  } catch (error) {
    console.error('Error rendering create form:', error);
    res.status(500).render('error', { 
      error: 'Failed to load create form',
      user: req.user 
    });
  }
};

exports.createPDA = async (req, res) => {
  try {
    const { serial_number, model, client_id, cost, status_id } = req.body;
    
    const validationErrors = validatePDAData({ serial_number, client_id, status_id, cost });
    if (validationErrors.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      
      return res.status(400).render('layout', {
        title: 'Add New PDA',
        body: 'pdas/create',
        errors: validationErrors,
        formData: req.body,
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        user: req.user
      });
    }

    // Check for duplicate serial number
    const existingPDA = await db.query(
      'SELECT id FROM pdas WHERE LOWER(serial_number) = LOWER($1)',
      [serial_number]
    );

    if (existingPDA.rows.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      
      return res.status(400).render('layout', {
        title: 'Add New PDA',
        body: 'pdas/create',
        errors: ['Serial number already exists'],
        formData: req.body,
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        user: req.user
      });
    }

    const result = await db.query(`
      INSERT INTO pdas (serial_number, model, client_id, cost, status_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [serial_number, model, client_id, cost || null, status_id]);

    const newPDA = result.rows[0];

    // Log history
    await logPDAHistory(newPDA.id, 'created', {
      serial_number: serial_number,
      model: model,
      client_id: client_id,
      cost: cost || null,
      status_id: status_id
    }, req.user.id);

    req.flash('success', 'PDA created successfully');
    res.redirect(`/pdas/${newPDA.id}`);
  } catch (error) {
    console.error('Error creating PDA:', error);
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    
    res.status(500).render('layout', {
      title: 'Add New PDA',
      body: 'pdas/create',
      errors: ['Failed to create PDA'],
      formData: req.body,
      clients: clientsResult.rows,
      user: req.user
    });
  }
};

exports.updatePDAForm = async (req, res) => {
  try {
    const { id } = req.params;

    const pdaResult = await db.query('SELECT * FROM pdas WHERE id = $1', [id]);

    if (pdaResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'PDA not found',
        user: req.user 
      });
    }

    // Get all clients for dropdown
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');

    res.render('layout', {
      title: `Edit PDA: ${pdaResult.rows[0].serial_number}`,
      body: 'pdas/edit',
      pda: pdaResult.rows[0],
      clients: clientsResult.rows,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching PDA for edit:', error);
    res.status(500).render('error', { 
      error: 'Failed to load edit form',
      user: req.user 
    });
  }
};

exports.updatePDA = async (req, res) => {
  try {
    const { id } = req.params;
    const { serial_number, client_id, has_sim_card } = req.body;

    const validationErrors = validatePDAData({ serial_number, client_id });
    if (validationErrors.length > 0) {
      const pdaResult = await db.query('SELECT * FROM pdas WHERE id = $1', [id]);
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      
      return res.status(400).render('layout', {
        title: `Edit PDA: ${pdaResult.rows[0].serial_number}`,
        body: 'pdas/edit',
        errors: validationErrors,
        pda: { ...pdaResult.rows[0], ...req.body },
        clients: clientsResult.rows,
        user: req.user
      });
    }

    // Get current PDA data
    const currentResult = await db.query('SELECT * FROM pdas WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'PDA not found',
        user: req.user 
      });
    }

    const currentPDA = currentResult.rows[0];

    // Check for duplicate serial number (excluding current PDA)
    const existingPDA = await db.query(
      'SELECT id FROM pdas WHERE LOWER(serial_number) = LOWER($1) AND id != $2',
      [serial_number, id]
    );

    if (existingPDA.rows.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      
      return res.status(400).render('layout', {
        title: `Edit PDA: ${currentPDA.serial_number}`,
        body: 'pdas/edit',
        errors: ['Serial number already exists'],
        pda: { ...currentPDA, ...req.body },
        clients: clientsResult.rows,
        user: req.user
      });
    }

    // Update PDA
    const result = await db.query(`
      UPDATE pdas 
      SET serial_number = $1, client_id = $2, has_sim_card = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [serial_number, client_id, has_sim_card === 'on', id]);

    // Log changes
    const changes = {};
    if (currentPDA.serial_number !== serial_number) changes.serial_number = { from: currentPDA.serial_number, to: serial_number };
    if (currentPDA.client_id !== parseInt(client_id)) changes.client_id = { from: currentPDA.client_id, to: parseInt(client_id) };
    if (currentPDA.has_sim_card !== (has_sim_card === 'on')) changes.has_sim_card = { from: currentPDA.has_sim_card, to: has_sim_card === 'on' };

    if (Object.keys(changes).length > 0) {
      await logPDAHistory(id, 'updated', { changes }, req.user.id);
    }

    req.flash('success', 'PDA updated successfully');
    res.redirect(`/pdas/${id}`);
  } catch (error) {
    console.error('Error updating PDA:', error);
    const pdaResult = await db.query('SELECT * FROM pdas WHERE id = $1', [req.params.id]);
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    
    res.status(500).render('layout', {
      title: `Edit PDA: ${pdaResult.rows[0]?.serial_number || 'Unknown'}`,
      body: 'pdas/edit',
      errors: ['Failed to update PDA'],
      pda: pdaResult.rows[0] || {},
      clients: clientsResult.rows,
      user: req.user
    });
  }
};

exports.deletePDA = async (req, res) => {
  try {
    const { id } = req.params;

    const pdaResult = await db.query('SELECT * FROM pdas WHERE id = $1', [id]);
    if (pdaResult.rows.length === 0) {
      return res.status(404).json({ error: 'PDA not found' });
    }

    const pda = pdaResult.rows[0];

    await db.query('DELETE FROM pdas WHERE id = $1', [id]);

    // Log deletion
    await logPDAHistory(id, 'deleted', {
      serial_number: pda.serial_number,
      client_id: pda.client_id
    }, req.user.id);

    req.flash('success', 'PDA deleted successfully');
    res.redirect('/pdas');
  } catch (error) {
    console.error('Error deleting PDA:', error);
    req.flash('error', 'Failed to delete PDA');
    res.redirect('/pdas');
  }
};

exports.getPDAHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const pdaResult = await db.query(`
      SELECT p.*, 
             c.name as client_name, c.client_id as client_code
      FROM pdas p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = $1
    `, [id]);
    
    if (pdaResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'PDA not found',
        user: req.user 
      });
    }

    const historyResult = await db.query(`
      SELECT h.*, u.name as performed_by_name
      FROM pda_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.pda_id = $1
      ORDER BY h.created_at DESC
    `, [id]);

    const history = historyResult.rows.map(row => ({
      ...row,
      action_details: typeof row.action_details === 'string'
        ? JSON.parse(row.action_details)
        : row.action_details
    }));

    res.render('layout', {
      title: `PDA History: ${pdaResult.rows[0].serial_number}`,
      body: 'pdas/history',
      pda: pdaResult.rows[0],
      history: history,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching PDA history:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch PDA history',
      user: req.user 
    });
  }
};

// Helper function for logging PDA history
async function logPDAHistory(pdaId, actionType, actionDetails, performedBy) {
  try {
    await db.query(`
      INSERT INTO pda_history (pda_id, action_type, action_details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [pdaId, actionType, JSON.stringify(actionDetails), performedBy]);

    console.log(`PDA history logged: ${actionType} for PDA ${pdaId}`);
  } catch (error) {
    console.error('Error logging PDA history:', error);
    throw error;
  }
}