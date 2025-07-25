// Add or modify the login function in your authController.js
// To ensure it responds appropriately to both regular and AJAX requests

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      if (req.isAjax) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      return res.render('auth/login', {
        title: 'Login',
        error: 'Email and password are required',
        email
      });
    }

    // Query for user
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (rows.length === 0) {
      console.log('User not found:', email);

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return res.render('auth/login', {
        title: 'Login',
        error: 'Invalid email or password',
        email
      });
    }

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log('Password mismatch for user:', email);

      if (req.isAjax) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return res.render('auth/login', {
        title: 'Login',
        error: 'Invalid email or password',
        email
      });
    }

    // Set user session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Log successful login
    console.log('User logged in successfully:', email);

    if (req.isAjax) {
      return res.json({
        success: true,
        redirect: '/'
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);

    if (req.isAjax) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred during login'
      });
    }

    res.render('auth/login', {
      title: 'Login',
      error: 'An error occurred during login',
      email: req.body.email
    });
  }
};
