const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Enhanced Input Validation and Sanitization Middleware
 * Provides comprehensive validation rules and XSS protection
 */

// Common validation rules
const commonValidations = {
  // String validation with length limits and XSS protection
  safeString: (field, minLength = 1, maxLength = 255) => [
    body(field)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`)
      .customSanitizer(value => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }))
      .escape()
  ],

  // Email validation
  email: (field = 'email') => [
    body(field)
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email must not exceed 255 characters')
  ],

  // Password validation with strength requirements
  password: (field = 'password', minLength = 8) => [
    body(field)
      .isLength({ min: minLength })
      .withMessage(`Password must be at least ${minLength} characters long`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],

  // Numeric validation
  numeric: (field, min = 0, max = Number.MAX_SAFE_INTEGER) => [
    body(field)
      .isNumeric()
      .withMessage(`${field} must be a number`)
      .toInt()
      .isInt({ min, max })
      .withMessage(`${field} must be between ${min} and ${max}`)
  ],

  // ID validation
  id: (field = 'id') => [
    param(field)
      .isInt({ min: 1 })
      .withMessage(`${field} must be a positive integer`)
      .toInt()
  ],

  // Boolean validation
  boolean: (field) => [
    body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be true or false`)
      .toBoolean()
  ],

  // Date validation
  date: (field) => [
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid date`)
      .toDate()
  ]
};

// Specific validation schemas
const validationSchemas = {
  // User authentication
  login: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email or CEP ID is required')
      .isLength({ max: 255 })
      .withMessage('Login field too long'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ max: 255 })
      .withMessage('Password too long')
  ],

  // User registration/creation
  createUser: [
    ...commonValidations.safeString('name', 2, 100),
    ...commonValidations.email(),
    ...commonValidations.password(),
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
    ...commonValidations.safeString('cep_id', 3, 20)
  ],

  // Asset/Item validation
  createItem: [
    ...commonValidations.safeString('name', 2, 255),
    ...commonValidations.safeString('cep_brc', 3, 50),
    ...commonValidations.safeString('serial_cod', 0, 100),
    ...commonValidations.safeString('model', 0, 100),
    ...commonValidations.numeric('price', 0, 999999.99),
    ...commonValidations.numeric('type_id', 1),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters')
      .customSanitizer(value => DOMPurify.sanitize(value))
  ],

  // Employee validation
  createEmployee: [
    ...commonValidations.safeString('name', 2, 100),
    ...commonValidations.email(),
    ...commonValidations.safeString('cep', 3, 20),
    ...commonValidations.numeric('dept_id', 1),
    ...commonValidations.date('joined_date'),
    ...commonValidations.safeString('job_title', 0, 100)
  ],

  // Search and pagination
  search: [
    query('q')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Search query too long')
      .customSanitizer(value => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })),
    query('page')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Page must be between 1 and 10000')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt()
  ]
};

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    console.warn('Validation errors:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.session?.user?.id,
      errors: formattedErrors
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: formattedErrors
      });
    }

    // For form submissions, flash errors and redirect back
    formattedErrors.forEach(error => {
      req.flash('error', error.message);
    });

    return res.redirect('back');
  }

  next();
};

// XSS Protection middleware
const xssProtection = (req, res, next) => {
  // Sanitize all string inputs
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = DOMPurify.sanitize(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
};

module.exports = {
  commonValidations,
  validationSchemas,
  handleValidationErrors,
  xssProtection
};
