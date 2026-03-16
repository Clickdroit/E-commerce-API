const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Joi validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: err.details ? err.details.map((d) => d.message) : [err.message],
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token', code: 'INVALID_TOKEN' },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Token expired', code: 'TOKEN_EXPIRED' },
    });
  }

  // PostgreSQL errors
  if (err.code) {
    // Unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { message: 'Resource already exists', code: 'DUPLICATE_ENTRY', details: [err.detail] },
      });
    }
    // Foreign key violation
    if (err.code === '23503') {
      return res.status(404).json({
        success: false,
        error: { message: 'Referenced resource not found', code: 'FOREIGN_KEY_VIOLATION' },
      });
    }
    // Not null violation
    if (err.code === '23502') {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required field', code: 'NOT_NULL_VIOLATION', details: [err.column] },
      });
    }
  }

  // Custom application errors with status code
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, code: err.code || 'APPLICATION_ERROR' },
    });
  }

  // Default 500
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : err.message,
      code: 'INTERNAL_ERROR',
    },
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' },
  });
}

module.exports = { errorHandler, notFoundHandler };
