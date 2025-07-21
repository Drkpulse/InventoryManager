const db = require('../config/db');

// Brand management
exports.getAllBrands = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM brands ORDER BY name');

    res.render('layout', {
      title: 'Brands',
      body: 'references/brands',
      brands: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).send('Server error');
  }
};

exports.createBrand = async (req, res) => {
  try {
    const { name } = req.body;

    await db.query('INSERT INTO brands (name) VALUES ($1)', [name]);

    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).send('Server error');
  }
};

exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE brands SET name = $1 WHERE id = $2', [name, id]);

    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if brand is used by items
    const check = await db.query('SELECT COUNT(*) FROM items WHERE brand_id = $1', [id]);

    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete brand that is in use');
    }

    await db.query('DELETE FROM brands WHERE id = $1', [id]);

    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).send('Server error');
  }
};

// Type management
exports.getAllTypes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM types ORDER BY name');

    res.render('layout', {
      title: 'Item Types',
      body: 'references/types',
      types: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).send('Server error');
  }
};

exports.createType = async (req, res) => {
  try {
    const { name } = req.body;

    await db.query('INSERT INTO types (name) VALUES ($1)', [name]);

    res.redirect('/references/types');
  } catch (error) {
    console.error('Error creating type:', error);
    res.status(500).send('Server error');
  }
};

exports.updateType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE types SET name = $1 WHERE id = $2', [name, id]);

    res.redirect('/references/types');
  } catch (error) {
    console.error('Error updating type:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if type is used by items
    const check = await db.query('SELECT COUNT(*) FROM items WHERE type_id = $1', [id]);

    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete type that is in use');
    }

    await db.query('DELETE FROM types WHERE id = $1', [id]);

    res.redirect('/references/types');
  } catch (error) {
    console.error('Error deleting type:', error);
    res.status(500).send('Server error');
  }
};

// Platform management
exports.getAllPlatforms = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM platforms ORDER BY name');

    res.render('layout', {
      title: 'Platforms',
      body: 'references/platforms',
      platforms: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).send('Server error');
  }
};

exports.createPlatform = async (req, res) => {
  try {
    const { id, name } = req.body;

    await db.query('INSERT INTO platforms (id, name) VALUES ($1, $2)', [id, name]);

    res.redirect('/references/platforms');
  } catch (error) {
    console.error('Error creating platform:', error);
    res.status(500).send('Server error');
  }
};

exports.updatePlatform = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE platforms SET name = $1 WHERE id = $2', [name, id]);

    res.redirect('/references/platforms');
  } catch (error) {
    console.error('Error updating platform:', error);
    res.status(500).send('Server error');
  }
};

exports.deletePlatform = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if platform is used by employees
    const check = await db.query('SELECT COUNT(*) FROM employees WHERE platform_id = $1', [id]);

    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete platform that is in use');
    }

    await db.query('DELETE FROM platforms WHERE id = $1', [id]);

    res.redirect('/references/platforms');
  } catch (error) {
    console.error('Error deleting platform:', error);
    res.status(500).send('Server error');
  }
};

// Office software management
exports.getAllOffices = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM offices ORDER BY name');

    res.render('layout', {
      title: 'Office Software',
      body: 'references/offices',
      offices: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching offices:', error);
    res.status(500).send('Server error');
  }
};

exports.createOffice = async (req, res) => {
  try {
    const { name } = req.body;

    await db.query('INSERT INTO offices (name) VALUES ($1)', [name]);

    res.redirect('/references/offices');
  } catch (error) {
    console.error('Error creating office software:', error);
    res.status(500).send('Server error');
  }
};

exports.updateOffice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE offices SET name = $1 WHERE id = $2', [name, id]);

    res.redirect('/references/offices');
  } catch (error) {
    console.error('Error updating office software:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteOffice = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if office software is used by employees
    const check = await db.query('SELECT COUNT(*) FROM employees WHERE office_id = $1', [id]);

    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete office software that is in use');
    }

    await db.query('DELETE FROM offices WHERE id = $1', [id]);

    res.redirect('/references/offices');
  } catch (error) {
    console.error('Error deleting office software:', error);
    res.status(500).send('Server error');
  }
};

// Sales/Receipt management
exports.getAllSales = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sales ORDER BY date_acquired DESC');

    res.render('layout', {
      title: 'Purchase Records',
      body: 'references/sales',
      sales: result.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching sales records:', error);
    res.status(500).send('Server error');
  }
};

exports.createSale = async (req, res) => {
  try {
    const { receipt, supplier, date_acquired } = req.body;

    await db.query(
      'INSERT INTO sales (receipt, supplier, date_acquired) VALUES ($1, $2, $3)',
      [receipt, supplier, date_acquired]
    );

    res.redirect('/references/sales');
  } catch (error) {
    console.error('Error creating sales record:', error);
    res.status(500).send('Server error');
  }
};

exports.updateSale = async (req, res) => {
  try {
    const { receipt } = req.params;
    const { supplier, date_acquired } = req.body;

    await db.query(
      'UPDATE sales SET supplier = $1, date_acquired = $2 WHERE receipt = $3',
      [supplier, date_acquired, receipt]
    );

    res.redirect('/references/sales');
  } catch (error) {
    console.error('Error updating sales record:', error);
    res.status(500).send('Server error');
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const { receipt } = req.params;

    // Check if receipt is used by items
    const check = await db.query('SELECT COUNT(*) FROM items WHERE receipt = $1', [receipt]);

    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).send('Cannot delete receipt that is in use');
    }

    await db.query('DELETE FROM sales WHERE receipt = $1', [receipt]);

    res.redirect('/references/sales');
  } catch (error) {
    console.error('Error deleting sales record:', error);
    res.status(500).send('Server error');
  }
};
