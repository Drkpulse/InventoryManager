const db = require('../config/db');

// Asset Types
exports.assetTypes = async (req, res) => {
  try {
    const types = await db.query(`
      SELECT
        t.id,
        t.name,
        t.description,
        COUNT(i.id) as item_count
      FROM types t
      LEFT JOIN items i ON i.type_id = t.id
      GROUP BY t.id, t.name, t.description
      ORDER BY t.name
    `);

    res.render('layout', {
      title: 'Asset Types',
      body: 'references/asset-types',
      user: req.session.user,
      types: types.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching asset types:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch asset types',
      user: req.session.user
    });
  }
};

exports.showAddAssetTypeForm = (req, res) => {
  res.render('references/add-asset-type', {
    title: 'Add Asset Type',
    formData: {},
  });
};

exports.addAssetType = async (req, res) => {
  try {
    console.log('=== ADD ASSET TYPE DEBUG ===');
    console.log('Request body:', req.body);

    const { name, description } = req.body;

    console.log('Name:', name, 'Description:', description);

    // Validate required fields
    if (!name || name.trim() === '') {
      console.log('Validation failed: name is empty');
      req.flash('error', 'Asset type name is required and cannot be empty');
      return res.render('references/add-asset-type', {
        title: 'Add Asset Type',
        formData: req.body
      });
    }

    // Trim whitespace from inputs
    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : null;

    // Check if asset type already exists
    const existingType = await db.query('SELECT id FROM types WHERE LOWER(name) = LOWER($1)', [trimmedName]);

    if (existingType.rows.length > 0) {
      console.log('Asset type already exists');
      req.flash('error', 'An asset type with this name already exists');
      return res.render('references/add-asset-type', {
        title: 'Add Asset Type',
        formData: req.body
      });
    }

    console.log('Inserting new asset type...');
    const result = await db.query(`
      INSERT INTO types (name, description, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id, name
    `, [trimmedName, trimmedDescription]);

    console.log('Insert result:', result.rows[0]);

    req.flash('success', 'Asset type added successfully');
    res.redirect('/references/asset-types');
  } catch (error) {
    console.error('Error adding asset type:', error);
    req.flash('error', 'Failed to add asset type: ' + error.message);
    res.render('references/add-asset-type', {
      title: 'Add Asset Type',
      formData: req.body
    });
  }
};

exports.showEditAssetTypeForm = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM types WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      req.flash('error', 'Asset type not found');
      return res.redirect('/references/asset-types');
    }

    res.render('references/edit-asset-type', {
      title: 'Edit Asset Type',
      assetType: result.rows[0]
    });
  } catch (error) {
    console.error('Error loading asset type for edit:', error);
    req.flash('error', 'Failed to load asset type');
    res.redirect('/references/asset-types');
  }
};

exports.editAssetType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    console.log('=== EDIT ASSET TYPE DEBUG ===');
    console.log('ID:', id, 'Body:', req.body);

    // Validate required fields
    if (!name || name.trim() === '') {
      req.flash('error', 'Asset type name is required and cannot be empty');
      return res.redirect(`/references/asset-types/${id}/edit`);
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : null;

    // Check if another asset type with the same name exists (excluding current one)
    const existingType = await db.query(
      'SELECT id FROM types WHERE LOWER(name) = LOWER($1) AND id != $2',
      [trimmedName, id]
    );

    if (existingType.rows.length > 0) {
      req.flash('error', 'An asset type with this name already exists');
      return res.redirect(`/references/asset-types/${id}/edit`);
    }

    const result = await db.query(`
      UPDATE types
      SET name = $1, description = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name
    `, [trimmedName, trimmedDescription, id]);

    if (result.rows.length === 0) {
      req.flash('error', 'Asset type not found');
      return res.redirect('/references/asset-types');
    }

    console.log('Update result:', result.rows[0]);

    req.flash('success', 'Asset type updated successfully');
    res.redirect('/references/asset-types');
  } catch (error) {
    console.error('Error updating asset type:', error);
    req.flash('error', 'Failed to update asset type: ' + error.message);
    res.redirect(`/references/asset-types/${req.params.id}/edit`);
  }
};

exports.deleteAssetType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if asset type is in use
    const usageCheck = await db.query('SELECT COUNT(*) as count FROM items WHERE type_id = $1', [id]);
    const usageCount = parseInt(usageCheck.rows[0].count);

    if (usageCount > 0) {
      req.flash('error', `Cannot delete this asset type because it is used by ${usageCount} assets`);
      return res.redirect('/references/asset-types');
    }

    const result = await db.query('DELETE FROM types WHERE id = $1 RETURNING name', [id]);

    if (result.rows.length === 0) {
      req.flash('error', 'Asset type not found');
    } else {
      req.flash('success', `Asset type "${result.rows[0].name}" deleted successfully`);
    }

    res.redirect('/references/asset-types');
  } catch (error) {
    console.error('Error deleting asset type:', error);
    req.flash('error', 'Failed to delete asset type');
    res.redirect('/references/asset-types');
  }
};

// Statuses
exports.statuses = async (req, res) => {
  try {
    const statuses = await db.query(`
      SELECT
        s.id,
        s.name,
        s.description,
        COUNT(i.id) as item_count
      FROM statuses s
      LEFT JOIN items i ON i.status_id = s.id
      GROUP BY s.id, s.name, s.description
      ORDER BY s.name
    `);

    res.render('layout', {
      title: 'Status Options',
      body: 'references/statuses',
      user: req.session.user,
      statuses: statuses.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching statuses:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch status options',
      user: req.session.user
    });
  }
};

exports.showAddStatusForm = (req, res) => {
  res.render('layout', {
    title: 'Add Status',
    body: 'references/add-status',
    user: req.session.user,
    isReferencePage: true
  });
};

exports.addStatus = async (req, res) => {
  try {
    const { name, description, icon, color, is_active } = req.body;

    // Get the next order number
    const maxOrderResult = await db.query('SELECT COALESCE(MAX(status_order), 0) + 1 as next_order FROM statuses');
    const nextOrder = maxOrderResult.rows[0].next_order;

    await db.query(`
      INSERT INTO statuses (name, description, icon, color, is_active, status_order)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      name,
      description,
      icon || 'fas fa-tag',
      color || 'gray',
      is_active === 'true',
      nextOrder
    ]);

    req.flash('success', 'Status added successfully');
    res.redirect('/references/statuses');
  } catch (error) {
    console.error('Error adding status:', error);
    req.flash('error', 'Failed to add status');
    res.redirect('/references/statuses/add');
  }
};

exports.showEditStatusForm = async (req, res) => {
  try {
    const statusId = req.params.id;

    const status = await db.query(`
      SELECT id, name, description, icon, color, is_active, status_order
      FROM statuses
      WHERE id = $1
    `, [statusId]);

    if (status.rows.length === 0) {
      req.flash('error', 'Status not found');
      return res.redirect('/references/statuses');
    }

    res.render('layout', {
      title: 'Edit Status',
      body: 'references/edit-status',
      user: req.session.user,
      status: status.rows[0],
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    req.flash('error', 'Could not fetch status data');
    res.redirect('/references/statuses');
  }
};

exports.editStatus = async (req, res) => {
  try {
    const statusId = req.params.id;
    const { name, description, icon, color, is_active } = req.body;

    await db.query(`
      UPDATE statuses
      SET name = $1, description = $2, icon = $3, color = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
    `, [
      name,
      description,
      icon || 'fas fa-tag',
      color || 'gray',
      is_active === 'true',
      statusId
    ]);

    req.flash('success', 'Status updated successfully');
    res.redirect('/references/statuses');
  } catch (error) {
    console.error('Error updating status:', error);
    req.flash('error', 'Failed to update status');
    res.redirect(`/references/statuses/${req.params.id}/edit`);
  }
};

exports.deleteStatus = async (req, res) => {
  try {
    const statusId = req.params.id;

    // Check if there are any items using this status
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM items
      WHERE status_id = $1
    `, [statusId]);

    if (parseInt(result.rows[0].count) > 0) {
      req.flash('error', `Cannot delete: This status is used by ${result.rows[0].count} items`);
      return res.redirect('/references/statuses');
    }

    await db.query(`DELETE FROM statuses WHERE id = $1`, [statusId]);

    req.flash('success', 'Status deleted successfully');
    res.redirect('/references/statuses');
  } catch (error) {
    console.error('Error deleting status:', error);
    req.flash('error', 'Failed to delete status');
    res.redirect('/references/statuses');
  }
};

// Locations
exports.locations = async (req, res) => {
  try {
    const locations = await db.query(`
      SELECT
        l.id,
        l.name,
        l.address,
        COUNT(DISTINCT i.id) as item_count,
        COUNT(DISTINCT e.id) as employee_count
      FROM locations l
      LEFT JOIN items i ON i.location_id = l.id
      LEFT JOIN employees e ON e.location_id = l.id
      GROUP BY l.id, l.name, l.address
      ORDER BY l.name
    `);

    res.render('layout', {
      title: 'Locations',
      body: 'references/locations',
      user: req.session.user,
      locations: locations.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch locations',
      user: req.session.user
    });
  }
};

exports.showAddLocationForm = (req, res) => {
  res.render('layout', {
    title: 'Add Location',
    body: 'references/add-location',
    user: req.session.user,
    isReferencePage: true
  });
};

exports.addLocation = async (req, res) => {
  try {
    const { name, address } = req.body;

    await db.query(`
      INSERT INTO locations (name, address)
      VALUES ($1, $2)
    `, [name, address]);

    req.flash('success', 'Location added successfully');
    res.redirect('/references/locations');
  } catch (error) {
    console.error('Error adding location:', error);
    req.flash('error', 'Failed to add location');
    res.redirect('/references/locations/add');
  }
};

exports.showEditLocationForm = async (req, res) => {
  try {
    const locationId = req.params.id;

    const location = await db.query(`
      SELECT id, name, address
      FROM locations
      WHERE id = $1
    `, [locationId]);

    if (location.rows.length === 0) {
      req.flash('error', 'Location not found');
      return res.redirect('/references/locations');
    }

    res.render('layout', {
      title: 'Edit Location',
      body: 'references/edit-location',
      user: req.session.user,
      location: location.rows[0],
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    req.flash('error', 'Could not fetch location data');
    res.redirect('/references/locations');
  }
};

exports.editLocation = async (req, res) => {
  try {
    const locationId = req.params.id;
    const { name, address } = req.body;

    await db.query(`
      UPDATE locations
      SET name = $1, address = $2
      WHERE id = $3
    `, [name, address, locationId]);

    req.flash('success', 'Location updated successfully');
    res.redirect('/references/locations');
  } catch (error) {
    console.error('Error updating location:', error);
    req.flash('error', 'Failed to update location');
    res.redirect(`/references/locations/${req.params.id}/edit`);
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const locationId = req.params.id;

    // Check if there are any items or employees using this location
    const itemResult = await db.query(`
      SELECT COUNT(*) as count
      FROM items
      WHERE location_id = $1
    `, [locationId]);

    const employeeResult = await db.query(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE location_id = $1
    `, [locationId]);

    const itemCount = parseInt(itemResult.rows[0].count);
    const employeeCount = parseInt(employeeResult.rows[0].count);

    if (itemCount > 0 || employeeCount > 0) {
      req.flash('error', `Cannot delete: This location is used by ${itemCount} items and ${employeeCount} employees`);
      return res.redirect('/references/locations');
    }

    await db.query(`DELETE FROM locations WHERE id = $1`, [locationId]);

    req.flash('success', 'Location deleted successfully');
    res.redirect('/references/locations');
  } catch (error) {
    console.error('Error deleting location:', error);
    req.flash('error', 'Failed to delete location');
    res.redirect('/references/locations');
  }
};

// Brands
exports.brands = async (req, res) => {
  try {
    const brands = await db.query(`
      SELECT
        b.id,
        b.name,
        COUNT(i.id) as item_count
      FROM brands b
      LEFT JOIN items i ON i.brand_id = b.id
      GROUP BY b.id, b.name
      ORDER BY b.name
    `);

    res.render('layout', {
      title: 'Brands',
      body: 'references/brands',
      user: req.session.user,
      brands: brands.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch brands',
      user: req.session.user
    });
  }
};

exports.showAddBrandForm = (req, res) => {
  res.render('layout', {
    title: 'Add Brand',
    body: 'references/add-brand',
    user: req.session.user,
    isReferencePage: true
  });
};

exports.addBrand = async (req, res) => {
  try {
    const { name } = req.body;

    await db.query(`
      INSERT INTO brands (name)
      VALUES ($1)
    `, [name]);

    req.flash('success', 'Brand added successfully');
    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error adding brand:', error);
    req.flash('error', 'Failed to add brand');
    res.redirect('/references/brands/add');
  }
};

exports.showEditBrandForm = async (req, res) => {
  try {
    const brandId = req.params.id;

    const brand = await db.query(`
      SELECT id, name
      FROM brands
      WHERE id = $1
    `, [brandId]);

    if (brand.rows.length === 0) {
      req.flash('error', 'Brand not found');
      return res.redirect('/references/brands');
    }

    res.render('layout', {
      title: 'Edit Brand',
      body: 'references/edit-brand',
      user: req.session.user,
      brand: brand.rows[0],
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    req.flash('error', 'Could not fetch brand data');
    res.redirect('/references/brands');
  }
};

exports.editBrand = async (req, res) => {
  try {
    const brandId = req.params.id;
    const { name } = req.body;

    await db.query(`
      UPDATE brands
      SET name = $1
      WHERE id = $2
    `, [name, brandId]);

    req.flash('success', 'Brand updated successfully');
    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error updating brand:', error);
    req.flash('error', 'Failed to update brand');
    res.redirect(`/references/brands/${req.params.id}/edit`);
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const brandId = req.params.id;

    // Check if there are any items using this brand
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM items
      WHERE brand_id = $1
    `, [brandId]);

    if (parseInt(result.rows[0].count) > 0) {
      req.flash('error', `Cannot delete: This brand is used by ${result.rows[0].count} items`);
      return res.redirect('/references/brands');
    }

    await db.query(`DELETE FROM brands WHERE id = $1`, [brandId]);

    req.flash('success', 'Brand deleted successfully');
    res.redirect('/references/brands');
  } catch (error) {
    console.error('Error deleting brand:', error);
    req.flash('error', 'Failed to delete brand');
    res.redirect('/references/brands');
  }
};

// Software (renamed from offices)
exports.software = async (req, res) => {
  try {
    const software = await db.query(`
      SELECT
        s.id,
        s.name,
        s.version,
        s.license_type,
        s.cost_per_license,
        s.vendor,
        s.description,
        s.max_licenses,
        COUNT(es.employee_id) as employee_count
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      GROUP BY s.id, s.name, s.version, s.license_type, s.cost_per_license, s.vendor, s.description, s.max_licenses
      ORDER BY s.name
    `);

    res.render('layout', {
      title: 'Software',
      body: 'references/software',
      user: req.session.user,
      software: software.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching software:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch software',
      user: req.session.user
    });
  }
};

exports.showAddSoftwareForm = (req, res) => {
  res.render('layout', {
    title: 'Add Software',
    body: 'references/add-software',
    user: req.session.user,
    isReferencePage: true
  });
};

exports.addSoftware = async (req, res) => {
  try {
    const { name, version, license_type, cost_per_license, vendor, description, max_licenses } = req.body;

    await db.query(`
      INSERT INTO software (name, version, license_type, cost_per_license, vendor, description, max_licenses)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, version, license_type, cost_per_license || null, vendor, description, max_licenses || 1]);

    req.flash('success', 'Software added successfully');
    res.redirect('/references/software');
  } catch (error) {
    console.error('Error adding software:', error);
    req.flash('error', 'Failed to add software');
    res.redirect('/references/software/add');
  }
};

exports.showEditSoftwareForm = async (req, res) => {
  try {
    const softwareId = req.params.id;

    const software = await db.query(`
      SELECT
        s.id,
        s.name,
        s.version,
        s.license_type,
        s.cost_per_license,
        s.vendor,
        s.description,
        s.max_licenses,
        COUNT(es.employee_id) as employee_count
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.version, s.license_type, s.cost_per_license, s.vendor, s.description, s.max_licenses
    `, [softwareId]);

    if (software.rows.length === 0) {
      req.flash('error', 'Software not found');
      return res.redirect('/references/software');
    }

    res.render('layout', {
      title: 'Edit Software',
      body: 'references/edit-software',
      user: req.session.user,
      software: software.rows[0],
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching software:', error);
    req.flash('error', 'Could not fetch software data');
    res.redirect('/references/software');
  }
};

exports.editSoftware = async (req, res) => {
  try {
    const softwareId = req.params.id;
    const { name, version, license_type, cost_per_license, vendor, description, max_licenses } = req.body;

    await db.query(`
      UPDATE software
      SET name = $1, version = $2, license_type = $3, cost_per_license = $4, vendor = $5, description = $6, max_licenses = $7
      WHERE id = $8
    `, [name, version, license_type, cost_per_license || null, vendor, description, max_licenses || 1, softwareId]);

    req.flash('success', 'Software updated successfully');
    res.redirect('/references/software');
  } catch (error) {
    console.error('Error updating software:', error);
    req.flash('error', 'Failed to update software');
    res.redirect(`/references/software/${req.params.id}/edit`);
  }
};

exports.deleteSoftware = async (req, res) => {
  try {
    const softwareId = req.params.id;

    // Check if there are any employees using this software
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employee_software
      WHERE software_id = $1
    `, [softwareId]);

    if (parseInt(result.rows[0].count) > 0) {
      req.flash('error', `Cannot delete: This software is assigned to ${result.rows[0].count} employees`);
      return res.redirect('/references/software');
    }

    await db.query(`DELETE FROM software WHERE id = $1`, [softwareId]);

    req.flash('success', 'Software deleted successfully');
    res.redirect('/references/software');
  } catch (error) {
    console.error('Error deleting software:', error);
    req.flash('error', 'Failed to delete software');
    res.redirect('/references/software');
  }
};

// Keep the old office exports for backward compatibility but redirect to software
exports.offices = (req, res) => {
  res.redirect('/references/software');
};

exports.showAddOfficeForm = (req, res) => {
  res.redirect('/references/software/add');
};

exports.addOffice = (req, res) => {
  res.redirect('/references/software');
};

exports.showEditOfficeForm = (req, res) => {
  res.redirect(`/references/software/${req.params.id}/edit`);
};

exports.editOffice = (req, res) => {
  res.redirect('/references/software');
};

exports.deleteOffice = (req, res) => {
  res.redirect('/references/software');
};

// Software assignment endpoints
exports.getSoftwareAssignments = async (req, res) => {
  try {
    const { id } = req.params;

    // Get software details
    const softwareResult = await db.query(`
      SELECT id, name, version, vendor, max_licenses
      FROM software
      WHERE id = $1
    `, [id]);

    if (softwareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Software not found' });
    }

    // Get assignments
    const assignmentsResult = await db.query(`
      SELECT
        es.employee_id,
        es.assigned_date,
        es.notes,
        e.name as employee_name,
        e.cep as employee_cep,
        d.name as department_name
      FROM employee_software es
      JOIN employees e ON es.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE es.software_id = $1
      ORDER BY es.assigned_date DESC
    `, [id]);

    res.json({
      software: softwareResult.rows[0],
      assignments: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching software assignments:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.assignSoftware = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, notes } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        error: 'Employee ID is required',
        type: 'validation_error'
      });
    }

    // Check if software exists and has available licenses
    const softwareResult = await db.query(`
      SELECT s.name, s.max_licenses, COUNT(es.employee_id) as current_assignments
      FROM software s
      LEFT JOIN employee_software es ON s.id = es.software_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.max_licenses
    `, [id]);

    if (softwareResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Software not found',
        type: 'not_found'
      });
    }

    const software = softwareResult.rows[0];
    const maxLicenses = parseInt(software.max_licenses) || 1;
    const currentAssignments = parseInt(software.current_assignments) || 0;

    if (currentAssignments >= maxLicenses) {
      return res.status(400).json({
        error: `No licenses available for ${software.name}. All ${maxLicenses} licenses are currently assigned.`,
        type: 'no_licenses_available',
        software_name: software.name,
        max_licenses: maxLicenses,
        current_assignments: currentAssignments
      });
    }

    // Check if already assigned
    const existingResult = await db.query(`
      SELECT es.id, e.name as employee_name, e.cep as employee_cep
      FROM employee_software es
      JOIN employees e ON es.employee_id = e.id
      WHERE es.software_id = $1 AND es.employee_id = $2
    `, [id, employee_id]);

    if (existingResult.rows.length > 0) {
      const existingAssignment = existingResult.rows[0];
      return res.status(400).json({
        error: `${software.name} is already assigned to ${existingAssignment.employee_name} (${existingAssignment.employee_cep})`,
        type: 'already_assigned',
        software_name: software.name,
        employee_name: existingAssignment.employee_name,
        employee_cep: existingAssignment.employee_cep
      });
    }

    // Get employee details for response
    const employeeResult = await db.query(`
      SELECT e.name, e.cep, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE e.id = $1
    `, [employee_id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Employee not found',
        type: 'not_found'
      });
    }

    const employee = employeeResult.rows[0];

    // Create assignment
    await db.query(`
      INSERT INTO employee_software (software_id, employee_id, assigned_date, notes)
      VALUES ($1, $2, CURRENT_DATE, $3)
    `, [id, employee_id, notes || null]);

    res.json({
      success: true,
      message: `${software.name} successfully assigned to ${employee.name} (${employee.cep})`,
      assignment: {
        software_name: software.name,
        employee_name: employee.name,
        employee_cep: employee.cep,
        department_name: employee.department_name
      }
    });
  } catch (error) {
    console.error('Error assigning software:', error);
    res.status(500).json({
      error: 'Server error occurred while assigning software',
      type: 'server_error'
    });
  }
};

exports.unassignSoftware = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id } = req.body;

    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    // Remove assignment
    const result = await db.query(`
      DELETE FROM employee_software
      WHERE software_id = $1 AND employee_id = $2
    `, [id, employee_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unassigning software:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStatuses = async (req, res) => {
  try {
    const statuses = await db.query(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.icon,
        s.color,
        s.is_active,
        s.status_order,
        COUNT(i.id) as item_count
      FROM statuses s
      LEFT JOIN items i ON i.status_id = s.id
      GROUP BY s.id, s.name, s.description, s.icon, s.color, s.is_active, s.status_order
      ORDER BY s.status_order ASC, s.name ASC
    `);

    res.render('layout', {
      title: 'Status Options',
      body: 'references/statuses',
      user: req.session.user,
      statuses: statuses.rows,
      isReferencePage: true
    });
  } catch (error) {
    console.error('Error fetching statuses:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch status options',
      user: req.session.user
    });
  }
};

exports.createStatus = async (req, res) => {
  try {
    const { name, description, icon, color, is_active } = req.body;

    await db.query(
      'INSERT INTO statuses (name, description, icon, color, is_active) VALUES ($1, $2, $3, $4, $5)',
      [name, description, icon || 'fas fa-tag', color || 'gray', is_active === 'true']
    );

    res.redirect('/references/statuses');
  } catch (error) {
    console.error('Error creating status:', error);
    res.status(500).render('error', { error: 'Failed to create status' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, is_active } = req.body;

    await db.query(
      'UPDATE statuses SET name = $1, description = $2, icon = $3, color = $4, is_active = $5 WHERE id = $6',
      [name, description, icon || 'fas fa-tag', color || 'gray', is_active === 'true', id]
    );

    res.redirect('/references/statuses');
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).render('error', { error: 'Failed to update status' });
  }
};

// Departments

exports.departments = async (req, res) => {
  try {
    // Get departments with employee counts
    const result = await db.query(`
      SELECT d.*, COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.dept_id AND e.left_date IS NULL
      GROUP BY d.id
      ORDER BY d.name
    `);

    res.render('layout', {
      title: 'Departments',
      body: 'references/departments',
      departments: result.rows,
      user: req.session.user,
      isDepartmentPage: true
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch departments',
      user: req.session.user
    });
  }
};

exports.showDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Get department details
    const deptResult = await db.query('SELECT * FROM departments WHERE id = $1', [id]);

    if (deptResult.rows.length === 0) {
      req.flash('error', 'Department not found');
      return res.redirect('/references/departments');
    }

    // Get employees in department
    const employeesResult = await db.query(`
      SELECT e.*, l.name as location_name
      FROM employees e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.dept_id = $1 AND e.left_date IS NULL
      ORDER BY e.name
    `, [id]);

    res.render('layout', {
      title: deptResult.rows[0].name + ' Department',
      body: 'references/show-departments',
      department: deptResult.rows[0],
      employees: employeesResult.rows,
      user: req.session.user,
      isDepartmentPage: true
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch department',
      user: req.session.user
    });
  }
};

exports.showAddDepartmentForm = (req, res) => {
  res.render('layout', {
    title: 'Add New Department',
    body: 'references/add-departments',
    user: req.session.user,
    isDepartmentPage: true
  });
};

exports.addDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    // Enhanced validation
    if (!name || name.trim() === '') {
      req.flash('error', 'Department name is required');
      return res.render('layout', {
        title: 'Add New Department',
        body: 'references/add-departments',
        user: req.session.user,
        isDepartmentPage: true
      });
    }

    const result = await db.query(
      'INSERT INTO departments (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    req.flash('success', 'Department created successfully');
    res.redirect('/references/departments');
  } catch (error) {
    console.error('Error creating department:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      req.flash('error', 'A department with this name already exists');
      return res.render('layout', {
        title: 'Add New Department',
        body: 'references/add-departments',
        user: req.session.user,
        isDepartmentPage: true
      });
    }

    req.flash('error', 'Failed to create department');
    res.render('layout', {
      title: 'Add New Department',
      body: 'references/add-departments',
      user: req.session.user,
      isDepartmentPage: true
    });
  }
};

exports.showEditDepartmentForm = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM departments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      req.flash('error', 'Department not found');
      return res.redirect('/references/departments');
    }

    res.render('layout', {
      title: 'Edit Department',
      body: 'references/edit-departments',
      department: result.rows[0],
      user: req.session.user,
      isDepartmentPage: true
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    req.flash('error', 'Could not fetch department');
    res.redirect('/references/departments');
  }
};

exports.editDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    await db.query('UPDATE departments SET name = $1 WHERE id = $2', [name, id]);

    req.flash('success', 'Department updated successfully');
    res.redirect('/references/departments');
  } catch (error) {
    console.error('Error updating department:', error);
    req.flash('error', 'Failed to update department');
    res.redirect(`/references/departments/${req.params.id}/edit`);
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are employees in this department
    const employeeCheck = await db.query('SELECT COUNT(*) as count FROM employees WHERE dept_id = $1', [id]);

    if (parseInt(employeeCheck.rows[0].count) > 0) {
      req.flash('error', 'Cannot delete department: There are employees assigned to this department');
      return res.redirect('/references/departments');
    }

    await db.query('DELETE FROM departments WHERE id = $1', [id]);

    req.flash('success', 'Department deleted successfully');
    res.redirect('/references/departments');
  } catch (error) {
    console.error('Error deleting department:', error);
    req.flash('error', 'Failed to delete department');
    res.redirect('/references/departments');
  }
};
