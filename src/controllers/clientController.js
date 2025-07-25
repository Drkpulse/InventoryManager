const db = require('../config/db');
const historyLogger = require('../utils/historyLogger');

const validateClientData = (data) => {
  const errors = [];

  if (!data.client_id || data.client_id.trim() === '') {
    errors.push('Client ID is required');
  }

  if (!data.name || data.name.trim() === '') {
    errors.push('Client name is required');
  }

  return errors;
};

exports.getAllClients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Count total clients for pagination
    const countResult = await db.query('SELECT COUNT(*) FROM clients');
    const totalClients = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalClients / perPage);

    // Get clients with pagination
    const clientsResult = await db.query(`
      SELECT c.*, 
             COUNT(p.id) as printer_count,
             COUNT(pd.id) as pda_count
      FROM clients c
      LEFT JOIN printers p ON c.id = p.client_id
      LEFT JOIN pdas pd ON c.id = pd.client_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [perPage, offset]);

    res.render('layout', {
      title: 'Client Management',
      body: 'clients/index',
      clients: clientsResult.rows,
      currentPage: page,
      totalPages: totalPages,
      totalClients: totalClients,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch clients',
      user: req.user 
    });
  }
};

exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const clientResult = await db.query(`
      SELECT c.*,
             COUNT(p.id) as printer_count,
             COUNT(pd.id) as pda_count
      FROM clients c
      LEFT JOIN printers p ON c.id = p.client_id
      LEFT JOIN pdas pd ON c.id = pd.client_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [id]);

    if (clientResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Client not found',
        user: req.user 
      });
    }

    const printersResult = await db.query(`
      SELECT p.*, e.name as employee_name
      FROM printers p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE p.client_id = $1
      ORDER BY p.created_at DESC
    `, [id]);

    const pdasResult = await db.query(`
      SELECT * FROM pdas
      WHERE client_id = $1
      ORDER BY serial_number
    `, [id]);

    res.render('layout', {
      title: `Client: ${clientResult.rows[0].name}`,
      body: 'clients/show',
      client: clientResult.rows[0],
      printers: printersResult.rows,
      pdas: pdasResult.rows,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch client details',
      user: req.user 
    });
  }
};

exports.createClientForm = async (req, res) => {
  try {
    res.render('layout', {
      title: 'Add New Client',
      body: 'clients/create',
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

exports.createClient = async (req, res) => {
  try {
    const { client_id, name, description } = req.body;
    
    const validationErrors = validateClientData({ client_id, name });
    if (validationErrors.length > 0) {
      return res.status(400).render('layout', {
        title: 'Add New Client',
        body: 'clients/create',
        errors: validationErrors,
        formData: req.body,
        user: req.user
      });
    }

    // Check for duplicate client_id
    const existingClient = await db.query(
      'SELECT id FROM clients WHERE LOWER(client_id) = LOWER($1)',
      [client_id]
    );

    if (existingClient.rows.length > 0) {
      return res.status(400).render('layout', {
        title: 'Add New Client',
        body: 'clients/create',
        errors: ['Client ID already exists'],
        formData: req.body,
        user: req.user
      });
    }

    const result = await db.query(`
      INSERT INTO clients (client_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [client_id, name, description]);

    const newClient = result.rows[0];

    // Log history
    await logClientHistory(newClient.id, 'created', {
      client_id: client_id,
      name: name,
      description: description
    }, req.user.id);

    req.flash('success', 'Client created successfully');
    res.redirect(`/clients/${newClient.id}`);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).render('layout', {
      title: 'Add New Client',
      body: 'clients/create',
      errors: ['Failed to create client'],
      formData: req.body,
      user: req.user
    });
  }
};

exports.updateClientForm = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM clients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Client not found',
        user: req.user 
      });
    }

    res.render('layout', {
      title: `Edit Client: ${result.rows[0].name}`,
      body: 'clients/edit',
      client: result.rows[0],
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching client for edit:', error);
    res.status(500).render('error', { 
      error: 'Failed to load edit form',
      user: req.user 
    });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, name, description } = req.body;

    const validationErrors = validateClientData({ client_id, name });
    if (validationErrors.length > 0) {
      const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
      return res.status(400).render('layout', {
        title: `Edit Client: ${clientResult.rows[0].name}`,
        body: 'clients/edit',
        errors: validationErrors,
        client: { ...clientResult.rows[0], ...req.body },
        user: req.user
      });
    }

    // Get current client data
    const currentResult = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Client not found',
        user: req.user 
      });
    }

    const currentClient = currentResult.rows[0];

    // Check for duplicate client_id (excluding current client)
    const existingClient = await db.query(
      'SELECT id FROM clients WHERE LOWER(client_id) = LOWER($1) AND id != $2',
      [client_id, id]
    );

    if (existingClient.rows.length > 0) {
      return res.status(400).render('layout', {
        title: `Edit Client: ${currentClient.name}`,
        body: 'clients/edit',
        errors: ['Client ID already exists'],
        client: { ...currentClient, ...req.body },
        user: req.user
      });
    }

    // Update client
    const result = await db.query(`
      UPDATE clients 
      SET client_id = $1, name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [client_id, name, description, id]);

    const updatedClient = result.rows[0];

    // Log changes
    const changes = {};
    if (currentClient.client_id !== client_id) changes.client_id = { from: currentClient.client_id, to: client_id };
    if (currentClient.name !== name) changes.name = { from: currentClient.name, to: name };
    if (currentClient.description !== description) changes.description = { from: currentClient.description, to: description };

    if (Object.keys(changes).length > 0) {
      await logClientHistory(id, 'updated', { changes }, req.user.id);
    }

    req.flash('success', 'Client updated successfully');
    res.redirect(`/clients/${id}`);
  } catch (error) {
    console.error('Error updating client:', error);
    const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.status(500).render('layout', {
      title: `Edit Client: ${clientResult.rows[0]?.name || 'Unknown'}`,
      body: 'clients/edit',
      errors: ['Failed to update client'],
      client: clientResult.rows[0] || {},
      user: req.user
    });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult.rows[0];

    // Check if client has printers or PDAs
    const printersResult = await db.query('SELECT COUNT(*) FROM printers WHERE client_id = $1', [id]);
    const pdasResult = await db.query('SELECT COUNT(*) FROM pdas WHERE client_id = $1', [id]);

    if (parseInt(printersResult.rows[0].count) > 0 || parseInt(pdasResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete client with associated printers or PDAs' 
      });
    }

    await db.query('DELETE FROM clients WHERE id = $1', [id]);

    // Log deletion
    await logClientHistory(id, 'deleted', {
      client_id: client.client_id,
      name: client.name
    }, req.user.id);

    req.flash('success', 'Client deleted successfully');
    res.redirect('/clients');
  } catch (error) {
    console.error('Error deleting client:', error);
    req.flash('error', 'Failed to delete client');
    res.redirect('/clients');
  }
};

exports.getClientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).render('error', { 
        error: 'Client not found',
        user: req.user 
      });
    }

    const historyResult = await db.query(`
      SELECT h.*, u.name as performed_by_name
      FROM client_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.client_id = $1
      ORDER BY h.created_at DESC
    `, [id]);

    const history = historyResult.rows.map(row => ({
      ...row,
      action_details: typeof row.action_details === 'string'
        ? JSON.parse(row.action_details)
        : row.action_details
    }));

    res.render('layout', {
      title: `Client History: ${clientResult.rows[0].name}`,
      body: 'clients/history',
      client: clientResult.rows[0],
      history: history,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching client history:', error);
    res.status(500).render('error', { 
      error: 'Failed to fetch client history',
      user: req.user 
    });
  }
};

// Helper function for logging client history
async function logClientHistory(clientId, actionType, actionDetails, performedBy) {
  try {
    await db.query(`
      INSERT INTO client_history (client_id, action_type, action_details, performed_by)
      VALUES ($1, $2, $3, $4)
    `, [clientId, actionType, JSON.stringify(actionDetails), performedBy]);

    console.log(`Client history logged: ${actionType} for client ${clientId}`);
  } catch (error) {
    console.error('Error logging client history:', error);
    throw error;
  }
}