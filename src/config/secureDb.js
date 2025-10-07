const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Enhanced Database Configuration with Security Features
 * Provides secure database connection with query logging and validation
 */

// Enhanced connection configuration
const poolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,

  // Security enhancements
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Set to true in production with proper SSL setup
  } : false,

  // Connection limits and timeouts
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 60000,

  // Query timeout
  query_timeout: 30000,
  statement_timeout: 30000,

  // Application name for logging
  application_name: 'inventory_manager_secure'
};

const pool = new Pool(poolConfig);

// Query logging for security monitoring
const sensitivePatterns = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i
];

const logQuery = (text, params, duration, error = null) => {
  // Redact sensitive information
  const isSensitive = sensitivePatterns.some(pattern => pattern.test(text));
  const logText = isSensitive ? text.replace(/\$\d+/g, '[REDACTED]') : text;
  const logParams = isSensitive ? '[REDACTED]' : params;

  const logEntry = {
    timestamp: new Date().toISOString(),
    query: logText,
    params: logParams,
    duration: `${duration}ms`,
    success: !error
  };

  if (error) {
    logEntry.error = error.message;
    console.error('Database query error:', logEntry);
  } else if (duration > 1000) {
    console.warn('Slow database query:', logEntry);
  } else if (process.env.LOG_LEVEL === 'debug') {
    console.debug('Database query:', logEntry);
  }
};

// Enhanced query function with security features
const secureQuery = async (text, params = []) => {
  const startTime = Date.now();
  let client;

  try {
    // Input validation
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid query: text must be a non-empty string');
    }

    if (!Array.isArray(params)) {
      throw new Error('Invalid query: params must be an array');
    }

    // Parameter count validation
    const paramMatches = text.match(/\$\d+/g);
    const expectedParamCount = paramMatches ? Math.max(...paramMatches.map(p => parseInt(p.slice(1)))) : 0;

    if (params.length < expectedParamCount) {
      throw new Error(`Parameter mismatch: query expects ${expectedParamCount} parameters, got ${params.length}`);
    }

    // Dangerous query detection
    const dangerousPatterns = [
      /;\s*(drop|delete|truncate|alter)\s+/i,
      /union\s+select/i,
      /'\s*or\s*'1'\s*=\s*'1/i,
      /--\s/,
      /\/\*.*\*\//
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(text));
    if (isDangerous) {
      console.error('Potentially dangerous query detected:', {
        query: text,
        params: '[REDACTED]',
        timestamp: new Date().toISOString()
      });
      throw new Error('Query contains potentially dangerous patterns');
    }

    client = await pool.connect();
    const result = await client.query(text, params);

    const duration = Date.now() - startTime;
    logQuery(text, params, duration);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    logQuery(text, params, duration, error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Secure transaction wrapper
const secureTransaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Prepared statement cache for frequently used queries
class PreparedStatementCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100;
  }

  getStatementName(query) {
    const hash = crypto.createHash('md5').update(query).digest('hex');
    return `stmt_${hash.substring(0, 16)}`;
  }

  async executeStatement(client, query, params) {
    const stmtName = this.getStatementName(query);

    if (!this.cache.has(stmtName)) {
      if (this.cache.size >= this.maxSize) {
        // Remove oldest entry
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      await client.query({
        name: stmtName,
        text: query
      });

      this.cache.set(stmtName, { query, prepared: true });
    }

    return client.query({
      name: stmtName,
      values: params
    });
  }
}

const stmtCache = new PreparedStatementCache();

// Enhanced query with prepared statements for better performance and security
const preparedQuery = async (text, params = []) => {
  const startTime = Date.now();
  let client;

  try {
    client = await pool.connect();
    const result = await stmtCache.executeStatement(client, text, params);

    const duration = Date.now() - startTime;
    logQuery(text, params, duration);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logQuery(text, params, duration, error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Connection monitoring
pool.on('connect', (client) => {
  console.debug('New database connection established');
});

pool.on('error', (err, client) => {
  console.error('Database pool error:', err);
});

// Health check function
const healthCheck = async () => {
  try {
    const result = await secureQuery('SELECT NOW() as timestamp, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp,
      version: result.rows[0].version,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
};

// Graceful shutdown
const shutdown = async () => {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

module.exports = {
  query: secureQuery,
  preparedQuery,
  transaction: secureTransaction,
  getClient: () => pool.connect(),
  pool,
  healthCheck,
  shutdown
};
