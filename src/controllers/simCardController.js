const db = require('../config/db');

const validateSIMCardData = (data) => {
  const errors = [];

  if (!data.sim_number || data.sim_number.trim() === '') {
    errors.push('SIM number is required');
  }

  if (!data.carrier || data.carrier.trim() === '') {
    errors.push('Carrier is required');
  }

  if (!data.client_id) {
    errors.push('Client is required');
  }

  return errors;
};

exports.getAllSIMCards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Parse query parameters for filtering
    const clientFilter = req.query.client || '';
    const statusFilter = req.query.status || '';
    const assignmentFilter = req.query.assignment || '';

    // Build the query conditions
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (clientFilter) {
      conditions.push(`s.client_id = $${paramCount++}`);
      params.push(clientFilter);
    }

    if (statusFilter) {
      conditions.push(`s.status_id = $${paramCount++}`);
      params.push(statusFilter);
    }

    if (assignmentFilter === 'assigned') {
      conditions.push(`s.pda_id IS NOT NULL`);
    } else if (assignmentFilter === 'unassigned') {
      conditions.push(`s.pda_id IS NULL`);
    }

    // Create the WHERE clause if conditions exist
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching SIM cards for pagination
    const countQuery = `
      SELECT COUNT(*)
      FROM sim_cards s
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, params);
    const totalSIMCards = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalSIMCards / perPage);

    // Get the filtered SIM cards with pagination
    const simCardsQuery = `
      SELECT s.*, 
             c.name as client_name, c.client_id as client_code,
             p.serial_number as pda_serial,
             st.name as status_name
      FROM sim_cards s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN pdas p ON s.pda_id = p.id
      LEFT JOIN statuses st ON s.status_id = st.id
      ${whereClause}
      ORDER BY s.sim_number
      LIMIT ${perPage} OFFSET ${offset}
    `;

    const simCardsResult = await db.query(simCardsQuery, params);

    // Get all clients and statuses for filter dropdowns
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

    res.render('layout', {
      title: 'SIM Card Management',
      body: 'simcards/index',
      simCards: simCardsResult.rows,
      clients: clientsResult.rows,
      statuses: statusesResult.rows,
      currentPage: page,
      totalPages: totalPages,
      totalSIMCards: totalSIMCards,
      filters: {
        client: clientFilter,
        status: statusFilter,
        assignment: assignmentFilter
      },
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching SIM cards:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch SIM cards',
      user: req.user 
    });
  }
};

exports.getSIMCardById = async (req, res) => {
  try {
    const { id } = req.params;

    const simCardResult = await db.query(`
      SELECT s.*, 
             c.name as client_name, c.client_id as client_code,
             p.serial_number as pda_serial, p.model as pda_model,
             st.name as status_name
      FROM sim_cards s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN pdas p ON s.pda_id = p.id
      LEFT JOIN statuses st ON s.status_id = st.id
      WHERE s.id = $1
    `, [id]);

    if (simCardResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'SIM card not found',
        user: req.user 
      });
    }

    res.render('layout', {
      title: `SIM Card: ${simCardResult.rows[0].sim_number}`,
      body: 'simcards/show',
      simCard: simCardResult.rows[0],
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching SIM card:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch SIM card details',
      user: req.user 
    });
  }
};

exports.createSIMCardForm = async (req, res) => {
  try {
    // Get all clients, PDAs, and statuses for dropdowns
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const pdasResult = await db.query(`
      SELECT p.id, p.serial_number, p.model, c.name as client_name 
      FROM pdas p 
      LEFT JOIN clients c ON p.client_id = c.id 
      ORDER BY p.serial_number
    `);
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

    res.render('layout', {
      title: 'Add New SIM Card',
      body: 'simcards/create',
      clients: clientsResult.rows,
      pdas: pdasResult.rows,
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

exports.createSIMCard = async (req, res) => {
  try {
    const { sim_number, carrier, client_id, pda_id, monthly_cost, status_id } = req.body;
    
    const validationErrors = validateSIMCardData({ sim_number, carrier, client_id });
    if (validationErrors.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const pdasResult = await db.query(`
        SELECT p.id, p.serial_number, p.model, c.name as client_name 
        FROM pdas p 
        LEFT JOIN clients c ON p.client_id = c.id 
        ORDER BY p.serial_number
      `);
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      
      return res.status(400).render('layout', {
        title: 'Add New SIM Card',
        body: 'simcards/create',
        errors: validationErrors,
        formData: req.body,
        clients: clientsResult.rows,
        pdas: pdasResult.rows,
        statuses: statusesResult.rows,
        user: req.user
      });
    }

    // Check for duplicate SIM number
    const existingSIM = await db.query(
      'SELECT id FROM sim_cards WHERE LOWER(sim_number) = LOWER($1)',
      [sim_number]
    );

    if (existingSIM.rows.length > 0) {
      const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
      const pdasResult = await db.query(`
        SELECT p.id, p.serial_number, p.model, c.name as client_name 
        FROM pdas p 
        LEFT JOIN clients c ON p.client_id = c.id 
        ORDER BY p.serial_number
      `);
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      
      return res.status(400).render('layout', {
        title: 'Add New SIM Card',
        body: 'simcards/create',
        errors: ['SIM number already exists'],
        formData: req.body,
        clients: clientsResult.rows,
        pdas: pdasResult.rows,
        statuses: statusesResult.rows,
        user: req.user
      });
    }

    const result = await db.query(`
      INSERT INTO sim_cards (sim_number, carrier, client_id, pda_id, monthly_cost, status_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [sim_number, carrier, client_id, pda_id || null, monthly_cost || null, status_id]);

    const newSIMCard = result.rows[0];

    // Log history
    await logSIMCardHistory(newSIMCard.id, 'created', {
      sim_number: sim_number,
      carrier: carrier,
      client_id: client_id,
      pda_id: pda_id || null,
      monthly_cost: monthly_cost || null,
      status_id: status_id
    }, req.user.id);

    req.flash('success', 'SIM card created successfully');
    res.redirect(`/simcards/${newSIMCard.id}`);
  } catch (error) {
    console.error('Error creating SIM card:', error);
    const clientsResult = await db.query('SELECT id, name, client_id FROM clients ORDER BY name');
    const pdasResult = await db.query(`
      SELECT p.id, p.serial_number, p.model, c.name as client_name 
      FROM pdas p 
      LEFT JOIN clients c ON p.client_id = c.id 
      ORDER BY p.serial_number
    `);
    const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
    
    res.status(500).render('layout', {
      title: 'Add New SIM Card',
      body: 'simcards/create',
      errors: ['Failed to create SIM card'],
      formData: req.body,
      clients: clientsResult.rows,
      pdas: pdasResult.rows,
      statuses: statusesResult.rows,
      user: req.user
    });
  }
};

// Helper function for logging SIM card history
async function logSIMCardHistory(simCardId, actionType, actionDetails, performedBy) {
  try {
    await db.query(`
      INSERT INTO sim_card_history (sim_card_id, action_type, action_details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [simCardId, actionType, JSON.stringify(actionDetails), performedBy]);

    console.log(`SIM card history logged: ${actionType} for SIM card ${simCardId}`);
  } catch (error) {
    console.error('Error logging SIM card history:', error);
    throw error;
  }
}