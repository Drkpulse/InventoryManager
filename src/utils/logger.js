/**
 * Simple logging utility for the inventory management system
 */

const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },

  error: (message, error = null, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, ...args);
  },

  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  // Helper method for database operations
  dbOperation: (operation, table, details = {}) => {
    logger.info(`DB Operation: ${operation} on ${table}`, details);
  },

  // Helper method for controller actions
  controllerAction: (controller, action, userId = null, details = {}) => {
    logger.info(`Controller: ${controller}.${action}`, { userId, ...details });
  }
};

module.exports = logger;
