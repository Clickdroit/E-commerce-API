const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    database: { status: 'unknown', latency: null },
    redis: { status: 'unknown', latency: null },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (err) {
    health.database = { status: 'error', error: err.message };
    health.status = 'degraded';
    logger.warn('Health check: database unavailable', { error: err.message });
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    health.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch (err) {
    health.redis = { status: 'error', error: err.message };
    health.status = 'degraded';
    logger.warn('Health check: redis unavailable', { error: err.message });
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({ success: true, data: health });
});

module.exports = router;
