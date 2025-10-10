const db = require('../config/db');
const bcrypt = require('bcrypt');

// Helper function to safely execute lockout-related queries
async function safeUserUpdate(query, params = []) {
  try {
    return await db.query(query, params);
  } catch (error) {
    if (error.code === '42703') {
      // Column doesn't exist, log warning but continue
      console.warn('Lockout columns not available, skipping update:', error.message);
      return { rows: [] };
    }
    throw error;
  }
}

exports.loginForm = async (req, res) => {
  res.render('layout', {
    title: 'Login',
    body: 'auth/login',
    error: req.flash('error'),
    email: req.body.email || req.body.login || '',
    user: null
  });
};

exports.login = async (req, res) => {
  try {
    const { email, login, password } = req.body;
    const loginInput = email || login; // Support both field names

    console.log('Login attempt:', {
      loginInput,
      isAjax: req.isAjax,
      headers: req.headers['x-requested-with'],
      contentType: req.headers['content-type'],
      body: req.body,
      bodyKeys: Object.keys(req.body)
    });

    // Validate input
    if (!loginInput || !password) {
      const errorMessage = 'Email/CEP ID and password are required';
      console.log('Validation failed:', { loginInput: !!loginInput, password: !!password });

      if (req.isAjax) {
        return res.status(400).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    // Query for user using the helper function (case-insensitive)
    let rows;
    try {
      const result = await db.query('SELECT * FROM find_user_by_login($1)', [loginInput]);
      rows = result.rows;
    } catch (dbError) {
      if (dbError.code === '42703') {
        // Column doesn't exist, use fallback query
        console.warn('find_user_by_login function failed, using fallback query');
        const fallbackResult = await db.query(`
          SELECT id, name, email, password, role, cep_id, active, settings, last_login, created_at, updated_at,
                 COALESCE(login_attempts, 0) as login_attempts,
                 COALESCE(login_attempts, 0) as failed_login_attempts,
                 false as account_locked,
                 NULL::TIMESTAMP as locked_at,
                 locked_until,
                 last_failed_login
          FROM users
          WHERE LOWER(email) = LOWER($1) OR LOWER(cep_id) = LOWER($1)
          LIMIT 1
        `, [loginInput]);
        rows = fallbackResult.rows;
      } else {
        throw dbError;
      }
    }

    if (rows.length === 0) {
      console.log('User not found:', loginInput);
      const errorMessage = 'Invalid email/CEP ID or password';

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    const user = rows[0];

    // Check if user is active
    if (user.active === false) {
      console.log('Inactive user attempted login:', loginInput);
      const errorMessage = 'Account is disabled. Please contact administrator.';

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    // Check if account is locked (safely handle missing columns)
    const accountLocked = user.account_locked || false;
    const lockedUntil = user.locked_until;
    const failedAttempts = user.failed_login_attempts || 0;

    if (accountLocked && lockedUntil && new Date() < new Date(lockedUntil)) {
      console.log(`🔒 Locked account attempted login: ${loginInput} - ${failedAttempts} failed attempts, locked until ${new Date(lockedUntil).toLocaleString()}`);
      const remainingMinutes = Math.ceil((new Date(lockedUntil) - new Date()) / (1000 * 60));
      const errorMessage = `Account is locked due to ${failedAttempts} failed login attempts. Please try again in ${remainingMinutes} minutes or contact an administrator.`;

      if (req.isAjax) {
        return res.status(423).json({
          success: false,
          message: errorMessage,
          locked: true,
          remainingMinutes,
          failedAttempts: failedAttempts
        });
      }
      req.flash('error', errorMessage);
      return res.redirect('/auth/login');
    }

    // If account was locked but time has expired, unlock it automatically
    if (accountLocked && lockedUntil && new Date() >= new Date(lockedUntil)) {
      console.log(`⏰ Auto-unlocking expired lock for user: ${loginInput} (${user.name}) - was locked for ${failedAttempts} failed attempts`);
      await safeUserUpdate(
        'UPDATE users SET account_locked = FALSE, failed_login_attempts = 0, locked_until = NULL, locked_at = NULL WHERE id = $1',
        [user.id]
      );
      // Update local user object to reflect the unlocked state
      if (typeof user.account_locked !== 'undefined') user.account_locked = false;
      if (typeof user.failed_login_attempts !== 'undefined') user.failed_login_attempts = 0;
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log('Password mismatch for user:', loginInput);

      // Increment failed login attempts
      const newFailedAttempts = failedAttempts + 1;
      const maxAttempts = 5;

      if (newFailedAttempts >= maxAttempts) {
        // Lock the account for 30 minutes
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await safeUserUpdate(
          'UPDATE users SET failed_login_attempts = $1, account_locked = TRUE, locked_at = CURRENT_TIMESTAMP, locked_until = $2 WHERE id = $3',
          [newFailedAttempts, lockUntil, user.id]
        );

        console.log(`🔒 Account locked: ${loginInput} (${user.name}) - ${newFailedAttempts} failed attempts, locked until ${lockUntil.toLocaleString()}`);
        const errorMessage = `Account locked due to ${maxAttempts} failed login attempts. Please try again in 30 minutes or contact an administrator.`;

        if (req.isAjax) {
          return res.status(423).json({
            success: false,
            message: errorMessage,
            locked: true,
            remainingMinutes: 30,
            failedAttempts: newFailedAttempts
          });
        }
        req.flash('error', errorMessage);
        return res.redirect('/auth/login');
      } else {
        // Just increment failed attempts
        await safeUserUpdate(
          'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
          [newFailedAttempts, user.id]
        );

        const remainingAttempts = maxAttempts - newFailedAttempts;
        console.log(`❌ Failed login attempt ${newFailedAttempts}/${maxAttempts}: ${loginInput} (${user.name}) - ${remainingAttempts} attempts remaining`);
        const errorMessage = `Invalid email/CEP ID or password. ${remainingAttempts} attempts remaining before account lockout.`;

        if (req.isAjax) {
          return res.status(401).json({
            success: false,
            message: errorMessage,
            remainingAttempts,
            currentFailedAttempts: newFailedAttempts
          });
        }
        req.flash('error', errorMessage);
        return res.redirect('/auth/login');
      }
    }

    // Load user permissions and roles
    try {
      const permissionsResult = await db.query(
        'SELECT * FROM get_user_permissions($1)',
        [user.id]
      );

      const rolesResult = await db.query(
        'SELECT * FROM get_user_roles($1)',
        [user.id]
      );

      // Set user session with enhanced data including settings
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        cep_id: user.cep_id,
        role: user.role, // Keep for backward compatibility
        settings: user.settings || {
          language: 'en',
          theme: 'light',
          timezone: 'UTC',
          items_per_page: '20',
          email_notifications: true,
          browser_notifications: true,
          maintenance_alerts: true,
          assignment_notifications: true,
          session_timeout: false,
          two_factor_auth: false
        },
        permissions: permissionsResult.rows.map(row => row.permission_name),
        roles: rolesResult.rows,
        roleNames: rolesResult.rows.map(role => role.display_name),
        permissionsLoadedAt: Date.now()
      };

      // Update last login and reset failed attempts
      await safeUserUpdate(
        'UPDATE users SET last_login = NOW(), failed_login_attempts = 0, account_locked = FALSE, locked_until = NULL WHERE id = $1',
        [user.id]
      );

      // Log successful login with role info
      console.log(`User logged in successfully: ${loginInput} (${user.name}) with roles: ${req.session.user.roleNames.join(', ')}`);

    } catch (permissionError) {
      console.error('Error loading permissions during login:', permissionError);

      // Fallback to basic session without permissions
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        cep_id: user.cep_id,
        role: user.role,
        permissions: [],
        roles: [],
        roleNames: []
      };
    }

    // Log session data before saving
    console.log('🔄 About to save session for user:', user.name);
    console.log('Session data before save:', {
      sessionId: req.sessionID,
      hasUser: !!req.session.user,
      userId: req.session.user?.id,
      userName: req.session.user?.name
    });

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error during login:', err);
        console.error('Redis connected:', global.redisConnected || 'unknown');
        console.error('Session store type:', req.session.store?.constructor?.name);

        if (req.isAjax) {
          return res.status(500).json({
            success: false,
            message: 'Login failed due to session error. Please try again.'
          });
        }
        req.flash('error', 'Login failed due to session error. Please try again.');
        return res.redirect('/auth/login');
      }

      console.log('✅ Session saved successfully for user:', user.name);
      console.log('Session ID:', req.sessionID);
      console.log('Session data after save:', {
        userId: req.session.user?.id,
        userName: req.session.user?.name,
        userEmail: req.session.user?.email,
        sessionExists: !!req.session,
        hasUser: !!req.session.user
      });

      if (req.isAjax) {
        // Set appropriate headers for JSON response
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          message: `Welcome back, ${user.name}!`,
          redirect: '/',
          user: {
            name: req.session.user.name,
            cep_id: req.session.user.cep_id,
            roles: req.session.user.roleNames
          }
        });
      }

      req.flash('success', `Welcome back, ${user.name}! You have been logged in successfully.`);
      res.redirect('/');
    });

  } catch (error) {
    console.error('Login error:', error);

    if (req.isAjax) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred during login'
      });
    }

    res.render('layout', {
      title: 'Login',
      body: 'auth/login',
      error: 'An error occurred during login',
      email: req.body.email || req.body.login,
      user: null
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userName = req.session?.user?.name || 'Unknown';
    const userCep = req.session?.user?.cep_id || 'Unknown';

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        req.flash('error', 'Error logging out');
        return res.redirect('/');
      }

      console.log(`User logged out: ${userName} (${userCep})`);
      res.redirect('/auth/login');
    });

  } catch (error) {
    console.error('Logout error:', error);
    req.flash('error', 'Error logging out');
    res.redirect('/');
  }
};

// Check authentication status (for AJAX calls)
exports.checkAuth = (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        cep_id: req.session.user.cep_id,
        roles: req.session.user.roleNames || [],
        permissions: req.session.user.permissions || []
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
};

// Refresh user permissions (useful after role changes)
exports.refreshPermissions = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    // Reload permissions and roles
    const permissionsResult = await db.query(
      'SELECT * FROM get_user_permissions($1)',
      [userId]
    );

    const rolesResult = await db.query(
      'SELECT * FROM get_user_roles($1)',
      [userId]
    );

    // Update session
    req.session.user.permissions = permissionsResult.rows.map(row => row.permission_name);
    req.session.user.roles = rolesResult.rows;
    req.session.user.roleNames = rolesResult.rows.map(role => role.display_name);
    req.session.user.permissionsLoadedAt = Date.now();

    console.log(`Refreshed permissions for user: ${req.session.user.name} (${req.session.user.cep_id})`);

    res.json({
      success: true,
      message: 'Permissions refreshed',
      user: {
        roles: req.session.user.roleNames,
        permissions: req.session.user.permissions
      }
    });

  } catch (error) {
    console.error('Error refreshing permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh permissions'
    });
  }
};
