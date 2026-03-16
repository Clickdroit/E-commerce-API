require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

const connection = (() => {
  try {
    const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
    return { host: url.hostname, port: parseInt(url.port, 10) || 6379 };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
})();

const emailQueue = new Queue('emails', { connection });
const shipmentQueue = new Queue('shipments', { connection });
const cleanupQueue = new Queue('cleanup', { connection });

emailQueue.on('error', (err) => logger.error('Email queue error', { error: err.message }));
shipmentQueue.on('error', (err) => logger.error('Shipment queue error', { error: err.message }));
cleanupQueue.on('error', (err) => logger.error('Cleanup queue error', { error: err.message }));

module.exports = { Queue, Worker, emailQueue, shipmentQueue, cleanupQueue, connection };
