require('dotenv').config();
const http = require('http');
const app = require('./app');
const { pool } = require('./config/database');
const redisClient = require('./config/redis');
const { initializeDatabase } = require('./models');
const { createWebSocketServer } = require('./websocket/inventorySocket');
const logger = require('./utils/logger');

// Import BullMQ workers (they auto-start on import)
require('./jobs/emailJob');
require('./jobs/shipmentJob');
require('./jobs/cleanupJob');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Attach WebSocket server
createWebSocketServer(server);

async function start() {
  // Connect Redis
  try {
    await redisClient.connect();
  } catch (err) {
    logger.warn('Redis connection failed at startup', { error: err.message });
  }

  // Initialize database schema
  try {
    await initializeDatabase();
  } catch (err) {
    logger.warn('Database schema initialization failed (may already be set up)', { error: err.message });
  }

  server.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`, { env: process.env.NODE_ENV, port: PORT });
  });
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error('Error closing Redis', { error: err.message });
    }

    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
    }

    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

start();

module.exports = server;
