const db = require('../config/db');
const logger = require('../utils/logger');

const assetController = {
  // GET /assets/printers - List all printer assets
  async listPrinters(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 20;
      const offset = (page - 1) * perPage;
      const search = req.query.q || '';
      const client_id = req.query.client_id || '';
      const status_id = req.query.status_id || '';
      const minPrice = req.query.minPrice || '';
      const maxPrice = req.query.maxPrice || '';

      // Build WHERE conditions
      let whereConditions = [`t.name = 'Printer'`];
      let queryParams = [];
      let paramIndex = 1;

      if (search) {
        whereConditions.push(`(LOWER(i.name) LIKE LOWER($${paramIndex}) OR LOWER(b.name) LIKE LOWER($${paramIndex}) OR LOWER(i.model) LIKE LOWER($${paramIndex}) OR LOWER(c.name) LIKE LOWER($${paramIndex}))`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (client_id) {
        whereConditions.push(`ca.client_id = $${paramIndex}`);
        queryParams.push(parseInt(client_id));
        paramIndex++;
      }

      if (status_id) {
        whereConditions.push(`i.status_id = $${paramIndex}`);
        queryParams.push(parseInt(status_id));
        paramIndex++;
      }

      if (minPrice) {
        whereConditions.push(`i.price >= $${paramIndex}`);
        queryParams.push(parseFloat(minPrice));
        paramIndex++;
      }

      if (maxPrice) {
        whereConditions.push(`i.price <= $${paramIndex}`);
        queryParams.push(parseFloat(maxPrice));
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records
      const countQuery = `
        SELECT COUNT(DISTINCT i.id) as total
        FROM items i
        JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        LEFT JOIN clients c ON ca.client_id = c.id
        LEFT JOIN statuses s ON i.status_id = s.id
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, queryParams);
      const totalRecords = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalRecords / perPage);

      // Main query with pagination
      const query = `
        SELECT DISTINCT
          i.id,
          i.cep_brc,
          i.name,
          b.name as brand,
          i.model,
          ca.client_id,
          c.name as client_name,
          c.pnumber as client_pnumber,
          i.price as cost,
          i.status_id,
          s.name as status_name,
          i.created_at,
          i.updated_at
        FROM items i
        JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        LEFT JOIN clients c ON ca.client_id = c.id
        LEFT JOIN statuses s ON i.status_id = s.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(perPage, offset);
      const result = await db.query(query, queryParams);

      // Get clients for filter dropdown
      const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');

      // Get statuses for filter dropdown
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

      res.render('layout', {
        title: 'Printer Assets',
        body: 'printers/index',
        printers: result.rows,
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          perPage: perPage,
          totalRecords: totalRecords,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        currentFilters: {
          q: search,
          client_id: req.query.client_id,
          status_id: req.query.status_id,
          minPrice: req.query.minPrice,
          maxPrice: req.query.maxPrice,
          page: page,
          perPage: perPage
        },
        query: req.query
      });

    } catch (error) {
      logger.error('Error fetching printer assets:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load printer assets',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // GET /assets/printers/new - Show create printer asset form
  async newPrinter(req, res) {
    try {
      // Get clients for dropdown
      const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');

      // Get statuses for dropdown
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

      // Get brands for dropdown
      const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

      res.render('layout', {
        title: 'Add New Printer Asset',
        body: 'printers/create',
        printer: {},
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        brands: brandsResult.rows,
        errors: {},
        query: req.query
      });

    } catch (error) {
      logger.error('Error loading new printer form:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load form',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // POST /assets/printers - Create new printer asset
  async create(req, res) {
    const client = await db.getClient();

    try {
      const { name, brand, model, serial_cod, client_id, cost, status_id } = req.body;
      const errors = {};

      // Validation
      if (!name?.trim()) errors.name = 'Printer name is required';
      if (!model?.trim()) errors.model = 'Model is required';
      if (!status_id) errors.status_id = 'Status is required';
      // Note: client_id is now optional for assets

      if (Object.keys(errors).length > 0) {
        // Get data for form repopulation
        const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');
        const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
        const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

        return res.status(400).render('layout', {
          title: 'Add New Printer Asset',
          body: 'printers/create',
          printer: req.body,
          clients: clientsResult.rows,
          statuses: statusesResult.rows,
          brands: brandsResult.rows,
          errors: errors,
          query: req.query
        });
      }

      await client.query('BEGIN');

      // Get printer type ID
      const typeResult = await client.query(`SELECT id FROM types WHERE name = 'Printer'`);
      if (typeResult.rows.length === 0) {
        throw new Error('Printer type not found');
      }
      const printerTypeId = typeResult.rows[0].id;

      // Handle brand - either get existing or create new
      let brandId = null;
      if (brand && brand.trim()) {
        // First try to find existing brand
        const existingBrand = await client.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1)', [brand.trim()]);

        if (existingBrand.rows.length > 0) {
          brandId = existingBrand.rows[0].id;
        } else {
          // Create new brand
          const brandResult = await client.query('INSERT INTO brands (name) VALUES ($1) RETURNING id', [brand.trim()]);
          brandId = brandResult.rows[0].id;
        }
      }

      // Generate unique CEP_BRC
      const cepResult = await client.query(`
        SELECT 'PRT-' || LPAD((COALESCE(MAX(CAST(SUBSTRING(cep_brc FROM 5) AS INTEGER)), 0) + 1)::text, 6, '0') as next_cep
        FROM items
        WHERE cep_brc LIKE 'PRT-%'
      `);
      const cepBrc = cepResult.rows[0].next_cep;

      // Insert printer asset
      const insertQuery = `
        INSERT INTO items (cep_brc, name, type_id, brand_id, model, serial_cod, price, status_id, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        cepBrc,
        name.trim(),
        printerTypeId,
        brandId,
        model.trim(),
        serial_cod ? serial_cod.trim() : null,
        cost ? parseFloat(cost) : null,
        parseInt(status_id),
        'Created as printer asset'
      ]);

      const printerId = result.rows[0].id;

      // Assign to client if specified
      if (client_id && parseInt(client_id) > 0) {
        await client.query(`
          INSERT INTO client_assets (client_id, item_id, assigned_date, notes)
          VALUES ($1, $2, CURRENT_DATE, 'Assigned during creation')
        `, [parseInt(client_id), printerId]);
      }

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user.id,
        'create',
        'printer_assets',
        printerId,
        JSON.stringify({
          name: name.trim(),
          brand: brand ? brand.trim() : null,
          model: model.trim(),
          serial_cod: serial_cod ? serial_cod.trim() : null,
          client_id: client_id ? parseInt(client_id) : null,
          cost: cost ? parseFloat(cost) : null,
          status_id: parseInt(status_id),
          cep_brc: cepBrc
        }),
        req.ip
      ]);

      // Log asset history
      await client.query(`
        INSERT INTO asset_history (item_id, action_type, action_details, performed_by)
        VALUES ($1, $2, $3, $4)
      `, [
        printerId,
        'created',
        JSON.stringify({
          name: name.trim(),
          brand: brand ? brand.trim() : null,
          model: model.trim(),
          serial_cod: serial_cod ? serial_cod.trim() : null,
          client_assigned: client_id ? parseInt(client_id) : null
        }),
        req.user.id
      ]);

      await client.query('COMMIT');

      req.flash('success', 'Printer asset created successfully');
      res.redirect('/printers');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating printer asset:', error);

      // Get data for form repopulation
      const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

      res.status(500).render('layout', {
        title: 'Add New Printer Asset',
        body: 'printers/create',
        printer: req.body,
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        brands: brandsResult.rows,
        errors: { general: 'Failed to create printer asset. Please try again.' },
        query: req.query
      });
    } finally {
      client.release();
    }
  },

  // GET /assets/printers/:id - Show printer asset details
  async show(req, res) {
    try {
      const printerId = parseInt(req.params.id);

      if (isNaN(printerId)) {
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'Invalid printer asset ID',
          error: {}
        });
      }

      const query = `
        SELECT
          i.*,
          b.name as brand,
          t.name as type_name,
          s.name as status_name,
          ca.client_id,
          c.name as client_name,
          c.pnumber as client_pnumber
        FROM items i
        JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN statuses s ON i.status_id = s.id
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        LEFT JOIN clients c ON ca.client_id = c.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `;

      const result = await db.query(query, [printerId]);

      if (result.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'The requested printer asset could not be found',
          error: {}
        });
      }

      res.render('layout', {
        title: 'Printer Asset Details',
        body: 'printers/show',
        printer: result.rows[0],
        query: req.query
      });

    } catch (error) {
      logger.error('Error fetching printer asset details:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load printer asset details',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // GET /assets/printers/:id/edit - Show edit printer asset form
  async edit(req, res) {
    try {
      const printerId = parseInt(req.params.id);

      if (isNaN(printerId)) {
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'Invalid printer asset ID',
          error: {}
        });
      }

      const query = `
        SELECT
          i.*,
          b.name as brand,
          t.name as type_name,
          ca.client_id
        FROM items i
        JOIN types t ON i.type_id = t.id
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `;

      const printerResult = await db.query(query, [printerId]);

      if (printerResult.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'The requested printer asset could not be found',
          error: {}
        });
      }

      // Get clients for dropdown
      const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');

      // Get statuses for dropdown
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');

      // Get brands for dropdown
      const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

      res.render('layout', {
        title: 'Edit Printer Asset',
        body: 'printers/edit',
        printer: printerResult.rows[0],
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        brands: brandsResult.rows,
        errors: {},
        query: req.query
      });

    } catch (error) {
      logger.error('Error loading edit printer form:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load edit form',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },

  // PUT /assets/printers/:id - Update printer asset
  async update(req, res) {
    const client = await db.getClient();

    try {
      const printerId = parseInt(req.params.id);
      const { name, brand, model, serial_cod, client_id, cost, status_id } = req.body;
      const errors = {};

      if (isNaN(printerId)) {
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'Invalid printer asset ID',
          error: {}
        });
      }

      // Validation
      if (!name?.trim()) errors.name = 'Printer name is required';
      if (!model?.trim()) errors.model = 'Model is required';
      if (!status_id) errors.status_id = 'Status is required';
      // Note: client_id is now optional for assets

      if (Object.keys(errors).length > 0) {
        // Get data for form repopulation
        const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');
        const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
        const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

        return res.status(400).render('layout', {
          title: 'Edit Printer Asset',
          body: 'printers/edit',
          printer: req.body,
          clients: clientsResult.rows,
          statuses: statusesResult.rows,
          brands: brandsResult.rows,
          errors: errors,
          query: req.query
        });
      }

      await client.query('BEGIN');

      // Get original data for history
      const originalResult = await client.query(`
        SELECT i.*, ca.client_id as current_client_id
        FROM items i
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        JOIN types t ON i.type_id = t.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `, [printerId]);

      if (originalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'The requested printer asset could not be found',
          error: {}
        });
      }

      const original = originalResult.rows[0];

      // Handle brand - either get existing or create new
      let brandId = null;
      if (brand && brand.trim()) {
        // First try to find existing brand
        const existingBrand = await client.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1)', [brand.trim()]);

        if (existingBrand.rows.length > 0) {
          brandId = existingBrand.rows[0].id;
        } else {
          // Create new brand
          const brandResult = await client.query('INSERT INTO brands (name) VALUES ($1) RETURNING id', [brand.trim()]);
          brandId = brandResult.rows[0].id;
        }
      }

      // Update the item
      const updateResult = await client.query(`
        UPDATE items
        SET name = $1, brand_id = $2, model = $3, serial_cod = $4, price = $5, status_id = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
      `, [
        name.trim(),
        brandId,
        model.trim(),
        serial_cod ? serial_cod.trim() : null,
        cost ? parseFloat(cost) : null,
        parseInt(status_id),
        printerId
      ]);

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).render('error', {
          title: 'Printer Asset Not Found',
          message: 'The requested printer asset could not be found',
          error: {}
        });
      }

      // Handle client assignment
      const newClientId = client_id && parseInt(client_id) > 0 ? parseInt(client_id) : null;
      const currentClientId = original.current_client_id;

      if (newClientId !== currentClientId) {
        // Remove old client assignment
        if (currentClientId) {
          await client.query('DELETE FROM client_assets WHERE item_id = $1', [printerId]);
        }

        // Add new client assignment
        if (newClientId) {
          await client.query(`
            INSERT INTO client_assets (client_id, item_id, assigned_date, notes)
            VALUES ($1, $2, CURRENT_DATE, 'Updated assignment')
          `, [newClientId, printerId]);
        }
      }

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user.id,
        'update',
        'printer_assets',
        printerId,
        JSON.stringify({
          changes: {
            name: { from: original.name, to: name.trim() },
            brand: { from: original.brand, to: brand ? brand.trim() : null },
            model: { from: original.model, to: model.trim() },
            serial_cod: { from: original.serial_cod, to: serial_cod ? serial_cod.trim() : null },
            client_id: { from: currentClientId, to: newClientId },
            cost: { from: original.price, to: cost ? parseFloat(cost) : null },
            status_id: { from: original.status_id, to: parseInt(status_id) }
          }
        }),
        req.ip
      ]);

      // Log asset history
      await client.query(`
        INSERT INTO asset_history (item_id, action_type, action_details, performed_by)
        VALUES ($1, $2, $3, $4)
      `, [
        printerId,
        'updated',
        JSON.stringify({
          changes: {
            name: { from: original.name, to: name.trim() },
            brand: { from: original.brand, to: brand ? brand.trim() : null },
            model: { from: original.model, to: model.trim() },
            serial_cod: { from: original.serial_cod, to: serial_cod ? serial_cod.trim() : null },
            client_id: { from: currentClientId, to: newClientId },
            cost: { from: original.price, to: cost ? parseFloat(cost) : null },
            status_id: { from: original.status_id, to: parseInt(status_id) }
          }
        }),
        req.user.id
      ]);

      await client.query('COMMIT');

      req.flash('success', 'Printer asset updated successfully');
      res.redirect('/printers');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating printer asset:', error);

      // Get data for form repopulation
      const clientsResult = await db.query('SELECT id, pnumber, name FROM clients ORDER BY name');
      const statusesResult = await db.query('SELECT id, name FROM statuses ORDER BY name');
      const brandsResult = await db.query('SELECT id, name FROM brands ORDER BY name');

      const printerResult = await db.query(`
        SELECT i.*, ca.client_id FROM items i
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        JOIN types t ON i.type_id = t.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `, [printerId]);

      res.status(500).render('layout', {
        title: 'Edit Printer Asset',
        body: 'printers/edit',
        printer: printerResult.rows[0] || req.body,
        clients: clientsResult.rows,
        statuses: statusesResult.rows,
        brands: brandsResult.rows,
        errors: { general: 'Failed to update printer asset. Please try again.' },
        query: req.query
      });
    } finally {
      client.release();
    }
  },

  // DELETE /assets/printers/:id - Delete printer asset
  async delete(req, res) {
    const client = await db.getClient();

    try {
      const printerId = parseInt(req.params.id);

      if (isNaN(printerId)) {
        return res.status(404).json({ error: 'Invalid printer asset ID' });
      }

      await client.query('BEGIN');

      // Get printer details for logging
      const printerResult = await client.query(`
        SELECT i.*, b.name as brand, ca.client_id
        FROM items i
        LEFT JOIN brands b ON i.brand_id = b.id
        LEFT JOIN client_assets ca ON ca.item_id = i.id
        JOIN types t ON i.type_id = t.id
        WHERE i.id = $1 AND t.name = 'Printer'
      `, [printerId]);

      if (printerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Printer asset not found' });
      }

      const printer = printerResult.rows[0];

      // Remove client assignments
      await client.query('DELETE FROM client_assets WHERE item_id = $1', [printerId]);

      // Delete the asset
      await client.query('DELETE FROM items WHERE id = $1', [printerId]);

      // Log the activity
      await client.query(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user.id,
        'delete',
        'printer_assets',
        printerId,
        JSON.stringify({
          deleted_printer: {
            name: printer.name,
            brand: printer.brand,
            model: printer.model,
            client_id: printer.client_id,
            cost: printer.price
          }
        }),
        req.ip
      ]);

      await client.query('COMMIT');

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.json({ success: true, message: 'Printer asset deleted successfully' });
      } else {
        req.flash('success', 'Printer asset deleted successfully');
        res.redirect('/printers');
      }

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting printer asset:', error);

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(500).json({ error: 'Failed to delete printer asset' });
      } else {
        req.flash('error', 'Failed to delete printer asset');
        res.redirect('/printers');
      }
    } finally {
      client.release();
    }
  }
};

module.exports = assetController;
