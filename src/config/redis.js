require('dotenv').config();
const Redis = require('ioredis');
const logger = require('../utils/logger');

const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

client.on('close', () => {
  logger.info('Redis connection closed');
});

module.exports = client;
