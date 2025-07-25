const db = require('../config/db');
const bcrypt = require('bcrypt');

// User Management
exports.users = async (req, res) => {
  try {
    // Fetch all users from database
    const usersResult = await db.query(`
      SELECT id, name, email, role, active, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.render('layout', {
      title: 'User Management',
      body: 'admin/users',
      users: usersResult.rows,
      currentUser: req.session.user, // Add this line
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not load users',
      user: req.session.user
    });
  }
};

exports.showAddUserForm = (req, res) => {
  res.render('layout', {
    title: 'Add User',
    body: 'admin/add-user',
    user: req.session.user,
    isAdminPage: true
  });
};

exports.addUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user
    await db.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
    `, [name, email, hashedPassword, role]);

    req.flash('success', 'User created successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error creating user:', error);
    req.flash('error', 'Failed to create user');
    res.redirect('/admin/users/add');
  }
};

exports.showEditUserForm = async (req, res) => {
  try {
    const userId = req.params.id;

    const userResult = await db.query(`
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    res.render('layout', {
      title: 'Edit User',
      body: 'admin/edit-user',
      user: req.session.user,
      editUser: userResult.rows[0],
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    req.flash('error', 'Could not fetch user data');
    res.redirect('/admin/users');
  }
};

exports.editUser = async (req, res) => {
	try {
	  const userId = req.params.id;
	  const { name, email, password, role } = req.body;

	  // Validate required fields
	  if (!name || name.trim() === '') {
		req.flash('error', 'Name is required and cannot be empty');
		return res.redirect(`/admin/users/${userId}/edit`);
	  }

	  if (!email || email.trim() === '') {
		req.flash('error', 'Email is required and cannot be empty');
		return res.redirect(`/admin/users/${userId}/edit`);
	  }

	  // Trim whitespace from inputs
	  const trimmedName = name.trim();
	  const trimmedEmail = email.trim();

	  if (password && password.trim() !== '') {
		// Update with new password
		const hashedPassword = await bcrypt.hash(password, 10);
		await db.query(`
		  UPDATE users
		  SET name = $1, email = $2, password = $3, role = $4, updated_at = NOW()
		  WHERE id = $5
		`, [trimmedName, trimmedEmail, hashedPassword, role, userId]);
	  } else {
		// Update without changing password
		await db.query(`
		  UPDATE users
		  SET name = $1, email = $2, role = $3, updated_at = NOW()
		  WHERE id = $4
		`, [trimmedName, trimmedEmail, role, userId]);
	  }

	  req.flash('success', 'User updated successfully');
	  res.redirect('/admin/users');
	} catch (error) {
	  console.error('Error updating user:', error);
	  req.flash('error', 'Failed to update user');
	  res.redirect(`/admin/users/${req.params.id}/edit`);
	}
  };

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow deleting yourself
    if (userId == req.session.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/admin/users');
    }

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    req.flash('success', 'User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    req.flash('error', 'Failed to delete user');
    res.redirect('/admin/users');
  }
};

// System Settings
exports.settings = async (req, res) => {
  try {
    const settingsResult = await db.query(`SELECT * FROM system_settings LIMIT 1`);

    res.render('layout', {
      title: 'System Settings',
      body: 'admin/settings',
      user: req.session.user,
      settings: settingsResult.rows[0] || {},
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch system settings',
      user: req.session.user
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { company_name, company_logo, default_language, items_per_page } = req.body;

    // Check if settings exist
    const settingsResult = await db.query(`SELECT id FROM system_settings LIMIT 1`);

    if (settingsResult.rows.length > 0) {
      // Update existing settings
      await db.query(`
        UPDATE system_settings
        SET company_name = $1, company_logo = $2, default_language = $3, items_per_page = $4
        WHERE id = $5
      `, [company_name, company_logo, default_language, items_per_page, settingsResult.rows[0].id]);
    } else {
      // Create new settings
      await db.query(`
        INSERT INTO system_settings (company_name, company_logo, default_language, items_per_page)
        VALUES ($1, $2, $3, $4)
      `, [company_name, company_logo, default_language, items_per_page]);
    }

    req.flash('success', 'System settings updated successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    req.flash('error', 'Failed to update system settings');
    res.redirect('/admin/settings');
  }
};

// Activity Logs
exports.logs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countResult = await db.query(`SELECT COUNT(*) as total FROM activity_logs`);
    const totalLogs = parseInt(countResult.rows[0].total);

    // Get logs with pagination
    const logs = await db.query(`
      SELECT l.*, u.name as user_name
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.render('layout', {
      title: 'Activity Logs',
      body: 'admin/logs',
      user: req.session.user,
      logs: logs.rows,
      pagination: {
        current: page,
        total: Math.ceil(totalLogs / limit),
        limit: limit
      },
      isAdminPage: true
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.render('layout', {
      title: 'Error',
      body: 'error',
      message: 'Could not fetch activity logs',
      user: req.session.user
    });
  }
};
