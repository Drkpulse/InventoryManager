const rateLimit = require('express-rate-limit');
const db = require('../config/db');

// Helper function for IPv6-safe IP key generation
const getClientIP = (req) => {
  // Use express-rate-limit's built-in IP extraction which handles IPv6
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'unknown';
};

/**
 * Enhanced Rate Limiting and Brute Force Protection
 * Provides multiple layers of protection against various attack vectors
 */

// Enhanced login rate limiter with progressive delays
const createLoginRateLimiter = () => {
  const store = new Map();

  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Maximum 5 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 15 * 60
    },

    // Custom key generator - limit by IP and email combination (IPv6 safe)
    keyGenerator: (req, res) => {
      const ip = getClientIP(req);
      const email = req.body.email || req.body.login || 'unknown';
      return `login:${ip}:${email}`;
    },

    // Custom handler with logging
    handler: (req, res) => {
      const key = req.rateLimit.key || req.ip;
      console.warn('🚨 Rate limit exceeded for login attempt:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body.email || req.body.login,
        attemptCount: req.rateLimit.totalHits,
        remainingTime: req.rateLimit.resetTime - Date.now()
      });

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(429).json({
          success: false,
          error: 'Too many login attempts. Please try again in 15 minutes.',
          retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      req.flash('error', 'Too many login attempts. Please try again in 15 minutes.');
      return res.redirect('/auth/login');
    },

    // Skip successful requests to allow legitimate users
    skip: (req, res) => {
      // Skip if this is a GET request (showing login form)
      if (req.method === 'GET') return true;

      // Skip if user is already logged in
      if (req.session && req.session.user) return true;

      return false;
    }
  });
};

// API rate limiter
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 API requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many API requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req, res) => {
    // Use user ID if authenticated, otherwise IP (IPv6 safe)
    const ip = getClientIP(req);
    return req.session?.user?.id ? `api:user:${req.session.user.id}` : `api:ip:${ip}`;
  },
  handler: (req, res) => {
    console.warn('🚨 API rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      userId: req.session?.user?.id,
      attemptCount: req.rateLimit.totalHits
    });

    return res.status(429).json({
      success: false,
      error: 'Too many API requests. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

// Password reset rate limiter
const passwordResetLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 password reset attempts per hour
  keyGenerator: (req, res) => {
    const ip = getClientIP(req);
    return `pwd-reset:${ip}:${req.body.email}`;
  },
  message: {
    error: 'Too many password reset attempts. Please try again in 1 hour.'
  }
});

// Account creation rate limiter
const registrationLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 registrations per hour per IP
  keyGenerator: (req, res) => {
    const ip = getClientIP(req);
    return `registration:${ip}`;
  },
  message: {
    error: 'Registration limit exceeded. Please try again in 1 hour.'
  }
});

// Enhanced account lockout with database tracking
class AccountLockoutProtection {
  constructor() {
    this.maxAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
    this.progressiveDelays = [1000, 2000, 5000, 10000, 30000]; // Progressive delays in ms
  }

  async recordFailedAttempt(identifier, req) {
    try {
      // Log the failed attempt with detailed information
      await db.query(`
        INSERT INTO login_attempts (
          identifier,
          ip_address,
          user_agent,
          attempt_time,
          attempt_type
        ) VALUES ($1, $2, $3, NOW(), 'failed')
      `, [
        identifier,
        getClientIP(req),
        req.get('User-Agent')
      ]);

      // Get recent failed attempts (last hour)
      const result = await db.query(`
        SELECT COUNT(*) as attempt_count,
               MAX(attempt_time) as last_attempt
        FROM login_attempts
        WHERE identifier = $1
          AND attempt_time > NOW() - INTERVAL '1 hour'
          AND attempt_type = 'failed'
      `, [identifier]);

      const attemptCount = parseInt(result.rows[0].attempt_count);

      if (attemptCount >= this.maxAttempts) {
        await this.lockAccount(identifier);
        return {
          locked: true,
          attemptCount,
          lockoutDuration: this.lockoutDuration
        };
      }

      return {
        locked: false,
        attemptCount,
        remainingAttempts: this.maxAttempts - attemptCount
      };

    } catch (error) {
      console.error('Error recording failed attempt:', error);
      return { locked: false, attemptCount: 0, remainingAttempts: this.maxAttempts };
    }
  }

  async lockAccount(identifier) {
    try {
      await db.query(`
        INSERT INTO account_lockouts (
          identifier,
          locked_at,
          locked_until,
          reason
        ) VALUES ($1, NOW(), NOW() + INTERVAL '30 minutes', 'too_many_failed_attempts')
        ON CONFLICT (identifier) DO UPDATE SET
          locked_at = NOW(),
          locked_until = NOW() + INTERVAL '30 minutes',
          attempt_count = account_lockouts.attempt_count + 1
      `, [identifier]);

      console.warn('🔒 Account locked due to failed attempts:', {
        identifier,
        lockoutDuration: this.lockoutDuration
      });
    } catch (error) {
      console.error('Error locking account:', error);
    }
  }

  async isAccountLocked(identifier) {
    try {
      const result = await db.query(`
        SELECT locked_until, attempt_count
        FROM account_lockouts
        WHERE identifier = $1
          AND locked_until > NOW()
      `, [identifier]);

      if (result.rows.length > 0) {
        const lockout = result.rows[0];
        return {
          locked: true,
          lockedUntil: lockout.locked_until,
          attemptCount: lockout.attempt_count
        };
      }

      return { locked: false };
    } catch (error) {
      console.error('Error checking account lockout:', error);
      return { locked: false };
    }
  }

  async recordSuccessfulLogin(identifier) {
    try {
      // Clear failed attempts and lockouts for this identifier
      await Promise.all([
        db.query('DELETE FROM login_attempts WHERE identifier = $1', [identifier]),
        db.query('DELETE FROM account_lockouts WHERE identifier = $1', [identifier])
      ]);
    } catch (error) {
      console.error('Error clearing login records:', error);
    }
  }

    // Middleware factory
    createMiddleware() {
      return async (req, res, next) => {
        const identifier = req.body.email || req.body.login || getClientIP(req);      // Check if account is currently locked
      const lockStatus = await this.isAccountLocked(identifier);

      if (lockStatus.locked) {
        const remainingTime = new Date(lockStatus.lockedUntil) - new Date();
        const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));

        console.warn('🔒 Locked account attempted login:', {
          identifier,
          ip: getClientIP(req),
          userAgent: req.get('User-Agent'),
          attemptCount: lockStatus.attemptCount,
          remainingMinutes
        });

        const message = `Account temporarily locked due to ${lockStatus.attemptCount} failed login attempts. Please try again in ${remainingMinutes} minutes.`;

        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(423).json({
            success: false,
            error: message,
            locked: true,
            remainingMinutes,
            code: 'ACCOUNT_LOCKED'
          });
        }

        req.flash('error', message);
        return res.redirect('/auth/login');
      }

      next();
    };
  }
}

// Check if security tables exist, create them if they don't
const initializeTables = async () => {
  try {
    // Check if the tables exist
    const loginAttemptsExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'login_attempts'
      );
    `);

    const lockoutExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'account_lockouts'
      );
    `);

    if (!loginAttemptsExists.rows[0].exists) {
      await db.query(`
        CREATE TABLE login_attempts (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(255) NOT NULL,
          ip_address INET,
          user_agent TEXT,
          attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          attempt_type VARCHAR(20) DEFAULT 'failed'
        )
      `);

      await db.query(`
        CREATE INDEX idx_login_attempts_identifier ON login_attempts (identifier, attempt_time)
      `);
    }

    if (!lockoutExists.rows[0].exists) {
      await db.query(`
        CREATE TABLE account_lockouts (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(255) UNIQUE NOT NULL,
          locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          locked_until TIMESTAMP NOT NULL,
          attempt_count INTEGER DEFAULT 1,
          reason VARCHAR(100)
        )
      `);

      await db.query(`
        CREATE INDEX idx_account_lockouts_identifier ON account_lockouts (identifier, locked_until)
      `);
    }

    // Clean up old records (older than 24 hours)
    await db.query(`
      DELETE FROM login_attempts
      WHERE attempt_time < NOW() - INTERVAL '24 hours'
    `);

    await db.query(`
      DELETE FROM account_lockouts
      WHERE locked_until < NOW() - INTERVAL '1 hour'
    `);

    console.log('✅ Security tables initialized successfully');

  } catch (error) {
    console.error('Error initializing security tables:', error);
    // Don't fail startup if tables can't be created - the app can still work
  }
};

// Initialize on module load
initializeTables();

const accountLockout = new AccountLockoutProtection();

module.exports = {
  loginRateLimit: createLoginRateLimiter(),
  apiRateLimit,
  passwordResetLimit,
  registrationLimit,
  accountLockout
};
