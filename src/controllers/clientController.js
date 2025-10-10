const db = require('../config/db');
const logger = require('../utils/logger');

const clientController = {
  // GET /clients - List all clients
  async index(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 20;
      const offset = (page - 1) * perPage;
      const search = req.query.search || '';

      // Base query parts
      let whereConditions = [];
      let queryParams = [];
      let paramCounter = 1;

      // Search functionality
      if (search) {
        whereConditions.push(`(
          c.pnumber ILIKE $${paramCounter} OR
          c.name ILIKE $${paramCounter} OR
          c.description ILIKE $${paramCounter}
        )`);
        queryParams.push(`%${search}%`);
        paramCounter++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records
      const countQuery = `
        SELECT COUNT(*) as total
        FROM clients c
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalRecords / perPage);

      // Fetch clients with asset counts from new structure
      const clientsQuery = `
        SELECT
          c.*,
          COALESCE(printer_assets.printer_count, 0) as printer_count,
          COALESCE(all_assets.total_assets, 0) as total_assets
        FROM clients c
        LEFT JOIN (
          SELECT ca.client_id, COUNT(*) as printer_count
          FROM client_assets ca
          JOIN items i ON ca.item_id = i.id
          JOIN types t ON i.type_id = t.id
          WHERE t.name = 'Printer'
          GROUP BY ca.client_id
        ) printer_assets ON c.id = printer_assets.client_id
        LEFT JOIN (
          SELECT ca.client_id, COUNT(*) as total_assets
          FROM client_assets ca
          JOIN items i ON ca.item_id = i.id
          GROUP BY ca.client_id
        ) all_assets ON c.id = all_assets.client_id
        ${whereClause}
        ORDER BY c.name ASC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `;

      queryParams.push(perPage, offset);
      const clientsResult = await db.query(clientsQuery, queryParams);

      res.render('layout', {
        title: 'Client Management',
        body: 'clients/index',
        clients: clientsResult.rows,
        pagination: {
          current: page,
          total: totalPages,
          perPage: perPage,
          totalRecords: totalRecords,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        currentFilters: {
          search: search,
          page: page,
          perPage: perPage
        },
        query: req.query,
        req: req,
        user: req.session.user
      });

    } catch (error) {
      logger.error('Error fetching clients:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load clients',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // GET /clients/new - Show create client form
  async new(req, res) {
    try {
      res.render('layout', {
        title: 'Add New Client',
        body: 'clients/create',
        client: {}, // Empty client for form
        errors: {},
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        req: req,
        user: req.session.user
      });

    } catch (error) {
      logger.error('Error loading client create form:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load create form',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // POST /clients - Create new client
  async create(req, res) {
    const client = await db.getClient();

    try {
      const { pnumber, name, description } = req.body;
      const errors = {};

      // Validation
      if (!pnumber?.trim()) {
        errors.pnumber = 'Client number is required';
      } else {
        // Check if pnumber already exists
        const existingResult = await db.query(
          'SELECT id FROM clients WHERE pnumber = $1',
          [pnumber.trim()]
        );
        if (existingResult.rows.length > 0) {
          errors.pnumber = 'Client number already exists';
        }
      }

      if (!name?.trim()) errors.name = 'Client name is required';

      if (Object.keys(errors).length > 0) {
        return res.status(400).render('layout', {
          title: 'Add New Client',
          body: 'clients/create',
          client: req.body,
          errors,
          csrfToken: req.csrfToken ? req.csrfToken() : '',
          req: req,
          user: req.session.user
        });
      }

      await client.query('BEGIN');

      // Insert client
      const insertResult = await client.query(`
        INSERT INTO clients (pnumber, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [
        pnumber.trim(),
        name.trim(),
        description?.trim() || null
      ]);

      const clientId = insertResult.rows[0].id;

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user?.id || null,
        'create',
        'clients',
        clientId,
        JSON.stringify({
          pnumber: pnumber.trim(),
          name: name.trim(),
          description: description?.trim() || null
        }),
        req.ip
      ]);

      // Log client history
      await client.query(`
        INSERT INTO client_history (client_id, action_type, action_details, performed_by)
        VALUES ($1, $2, $3, $4)
      `, [
        clientId,
        'created',
        JSON.stringify({
          pnumber: pnumber.trim(),
          name: name.trim(),
          description: description?.trim() || null
        }),
        req.user?.id || null
      ]);

      await client.query('COMMIT');

      req.flash('success', 'Client created successfully');
      res.redirect('/clients');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating client:', error);

      res.status(500).render('layout', {
        title: 'Add New Client',
        body: 'clients/create',
        client: req.body,
        errors: { general: 'Failed to create client. Please try again.' },
        req: req,
        user: req.session.user
      });
    } finally {
      client.release();
    }
  },

  // GET /clients/:id - Show single client
  async show(req, res) {
    try {
      const clientId = parseInt(req.params.id);

      if (isNaN(clientId)) {
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'Invalid client ID',
          error: {}
        });
      }

      // Fetch client details
      const clientResult = await db.query(
        'SELECT * FROM clients WHERE id = $1',
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'The requested client could not be found',
          error: {}
        });
      }

      // Fetch associated assets from new structure
      const assetsResult = await db.query(`
        SELECT
          i.*,
          t.name as type_name,
          b.name as brand_name,
          s.name as status_name,
          s.color as status_color,
          s.icon as status_icon,
          ca.assigned_date
        FROM client_assets ca
        JOIN items i ON ca.item_id = i.id
        JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN statuses s ON i.status_id = s.id
        WHERE ca.client_id = $1
        ORDER BY i.name, i.model
      `, [clientId]);

      // Transform assets to unified format
      const assets = assetsResult.rows.map(asset => ({
        ...asset,
        asset_type: asset.type_name.toLowerCase(),
        name: asset.name || asset.model || `Unnamed ${asset.type_name}`,
        serial_number: asset.serial_cod
      }));

      // Create asset summary by type
      const assetSummary = {
        total: assets.length
      };

      // Count assets by type
      assets.forEach(asset => {
        const type = asset.type_name.toLowerCase() + 's';
        assetSummary[type] = (assetSummary[type] || 0) + 1;
      });

      // For backward compatibility, separate printers
      const printers = assets.filter(asset => asset.type_name === 'Printer');

      // Fetch client history
      const historyResult = await db.query(`
        SELECT
          ch.*,
          u.name as performed_by_name
        FROM client_history ch
        LEFT JOIN users u ON ch.performed_by = u.id
        WHERE ch.client_id = $1
        ORDER BY ch.created_at DESC
        LIMIT 50
      `, [clientId]);

      res.render('layout', {
        title: `Client Details - ${clientResult.rows[0].name}`,
        body: 'clients/show',
        client: clientResult.rows[0],
        assets: assets,
        assetSummary: assetSummary,
        printers: printers,
        history: historyResult.rows,
        user: req.session.user
      });

    } catch (error) {
      logger.error('Error fetching client details:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load client details',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // GET /clients/:id/edit - Show edit client form
  async edit(req, res) {
    try {
      const clientId = parseInt(req.params.id);

      if (isNaN(clientId)) {
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'Invalid client ID',
          error: {}
        });
      }

      const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [clientId]);

      if (clientResult.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'The requested client could not be found',
          error: {}
        });
      }

      res.render('layout', {
        title: `Edit Client - ${clientResult.rows[0].name}`,
        body: 'clients/edit',
        client: clientResult.rows[0],
        errors: {},
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        req: req,
        user: req.session.user
      });

    } catch (error) {
      logger.error('Error loading client edit form:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load edit form',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // PUT /clients/:id - Update client
  async update(req, res) {
    const client = await db.getClient();

    try {
      const clientId = parseInt(req.params.id);
      const { pnumber, name, description } = req.body;
      const errors = {};

      if (isNaN(clientId)) {
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'Invalid client ID',
          error: {}
        });
      }

      // Validation
      if (!pnumber?.trim()) {
        errors.pnumber = 'Client number is required';
      } else {
        // Check if pnumber already exists (excluding current client)
        const existingResult = await db.query(
          'SELECT id FROM clients WHERE pnumber = $1 AND id != $2',
          [pnumber.trim(), clientId]
        );
        if (existingResult.rows.length > 0) {
          errors.pnumber = 'Client number already exists';
        }
      }

      if (!name?.trim()) errors.name = 'Client name is required';

      if (Object.keys(errors).length > 0) {
        const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [clientId]);

        return res.status(400).render('layout', {
          title: 'Edit Client',
          body: 'clients/edit',
          client: { ...clientResult.rows[0], ...req.body },
          errors,
          csrfToken: req.csrfToken ? req.csrfToken() : '',
          req: req,
          user: req.session.user
        });
      }

      await client.query('BEGIN');

      // Get original data for history
      const originalResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      const original = originalResult.rows[0];

      if (!original) {
        await client.query('ROLLBACK');
        return res.status(404).render('error', {
          title: 'Client Not Found',
          message: 'The requested client could not be found',
          error: {}
        });
      }

      // Update client
      const updateResult = await client.query(`
        UPDATE clients
        SET pnumber = $1, name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [
        pnumber.trim(),
        name.trim(),
        description?.trim() || null,
        clientId
      ]);

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user?.id || null,
        'update',
        'clients',
        clientId,
        JSON.stringify({
          changes: {
            pnumber: { from: original.pnumber, to: pnumber.trim() },
            name: { from: original.name, to: name.trim() },
            description: { from: original.description, to: description?.trim() || null }
          }
        }),
        req.ip
      ]);

      // Log client history
      await client.query(`
        INSERT INTO client_history (client_id, action_type, action_details, performed_by)
        VALUES ($1, $2, $3, $4)
      `, [
        clientId,
        'updated',
        JSON.stringify({
          changes: {
            pnumber: { from: original.pnumber, to: pnumber.trim() },
            name: { from: original.name, to: name.trim() },
            description: { from: original.description, to: description?.trim() || null }
          }
        }),
        req.user?.id || null
      ]);

      await client.query('COMMIT');

      req.flash('success', 'Client updated successfully');
      res.redirect(`/clients/${clientId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating client:', error);

      const clientResult = await db.query('SELECT * FROM clients WHERE id = $1', [parseInt(req.params.id)]);

      res.status(500).render('layout', {
        title: 'Edit Client',
        body: 'clients/edit',
        client: clientResult.rows[0] || req.body,
        errors: { general: 'Failed to update client. Please try again.' },
        req: req,
        user: req.session.user
      });
    } finally {
      client.release();
    }
  },



  // DELETE /clients/:id - Delete client
  async delete(req, res) {
    const client = await db.getClient();

    try {
      const clientId = parseInt(req.params.id);
      const { pnumberConfirmation } = req.body;

      if (isNaN(clientId)) {
        return res.status(404).json({ error: 'Invalid client ID' });
      }

      await client.query('BEGIN');

      // Get client details for confirmation and logging
      const clientResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);

      if (clientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Client not found' });
      }

      const clientData = clientResult.rows[0];

      // Verify pnumber confirmation
      if (pnumberConfirmation !== clientData.pnumber) {
        await client.query('ROLLBACK');
        return res.status(400).redirect(`/clients?error=invalid_pnumber_confirmation`);
      }

      // Check if client still has assets using new structure
      const assetsCheckResult = await client.query(
        'SELECT COUNT(*) as count FROM client_assets WHERE client_id = $1',
        [clientId]
      );

      const totalAssets = parseInt(assetsCheckResult.rows[0].count);

      if (totalAssets > 0) {
        await client.query('ROLLBACK');
        return res.status(400).redirect(`/clients?error=client_has_assets`);
      }

      // Delete client (cascade will handle history)
      await client.query('DELETE FROM clients WHERE id = $1', [clientId]);

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user?.id || null,
        'delete',
        'clients',
        clientId,
        JSON.stringify({
          deleted_client: {
            pnumber: clientData.pnumber,
            name: clientData.name,
            description: clientData.description
          }
        }),
        req.ip
      ]);

      await client.query('COMMIT');

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.json({ success: true, message: 'Client deleted successfully' });
      } else {
        req.flash('success', 'Client deleted successfully');
        res.redirect('/clients?deleted=true');
      }

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting client:', error);

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(500).json({ error: 'Failed to delete client' });
      } else {
        req.flash('error', 'Failed to delete client');
        res.redirect('/clients');
      }
    } finally {
      client.release();
    }
  },

  // POST /clients/:id/assign-printer - Assign printer to client
  async assignPrinter(req, res) {
    const client = await db.getClient();

    try {
      const clientId = parseInt(req.params.id);
      const { printerId } = req.body;

      if (isNaN(clientId)) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }

      if (!printerId) {
        return res.status(400).json({ error: 'Printer ID is required' });
      }

      await client.query('BEGIN');

      // Verify client exists
      const clientResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (clientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Client not found' });
      }

      // Verify printer exists and is available
      const printerResult = await client.query(`
        SELECT i.*, t.name as type_name
        FROM items i
        JOIN types t ON i.type_id = t.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `, [printerId]);

      if (printerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Printer not found' });
      }

      // Check if printer is already assigned
      const assignmentCheck = await client.query(
        'SELECT client_id FROM client_assets WHERE item_id = $1',
        [printerId]
      );

      if (assignmentCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Printer is already assigned to another client' });
      }

      // Assign printer to client
      await client.query(`
        INSERT INTO client_assets (client_id, item_id, assigned_date, notes)
        VALUES ($1, $2, CURRENT_DATE, 'Assigned via client management')
      `, [clientId, printerId]);

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user?.id || null,
        'assign',
        'clients',
        clientId,
        JSON.stringify({
          printer_assigned: {
            id: printerId,
            name: printerResult.rows[0].name || printerResult.rows[0].model,
            serial: printerResult.rows[0].serial_cod
          }
        }),
        req.ip
      ]);

      // Log client history
      await client.query(`
        INSERT INTO client_history (client_id, action_type, action_details, performed_by)
        VALUES ($1, $2, $3, $4)
      `, [
        clientId,
        'printer_assigned',
        JSON.stringify({
          printer: {
            id: printerId,
            name: printerResult.rows[0].name || printerResult.rows[0].model,
            serial: printerResult.rows[0].serial_cod
          }
        }),
        req.user?.id || null
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Printer assigned successfully',
        printer: printerResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error assigning printer to client:', error);
      res.status(500).json({ error: 'Failed to assign printer' });
    } finally {
      client.release();
    }
  }
};

module.exports = clientController;
