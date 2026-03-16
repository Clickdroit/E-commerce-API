require('dotenv').config();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: 'Access token required', code: 'MISSING_TOKEN' },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Authentication failed', { error: err.message });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Access token expired', code: 'TOKEN_EXPIRED' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid access token', code: 'INVALID_TOKEN' },
    });
  }
}

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch {
    // Token invalid or missing — continue without user
  }
  next();
}

module.exports = { authenticate, optionalAuth };
