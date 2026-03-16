const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const cleanupWorker = new Worker(
  'cleanup',
  async (job) => {
    const { type } = job.data;

    switch (type) {
      case 'expire-orders': {
        // Cancel pending orders older than 24 hours
        const result = await query(
          `UPDATE orders
           SET status = 'cancelled', updated_at = NOW()
           WHERE status = 'pending'
             AND created_at < NOW() - INTERVAL '24 hours'
           RETURNING id`,
          []
        );
        logger.info('Expired pending orders cancelled', { count: result.rowCount, jobId: job.id });
        return { cancelledCount: result.rowCount };
      }

      case 'cleanup-tokens': {
        // Delete expired refresh tokens
        const result = await query(
          'DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id',
          []
        );
        logger.info('Expired refresh tokens cleaned up', { count: result.rowCount, jobId: job.id });
        return { deletedCount: result.rowCount };
      }

      default:
        logger.warn('Unknown cleanup job type', { type, jobId: job.id });
    }
  },
  { connection }
);

cleanupWorker.on('completed', (job) => {
  logger.debug('Cleanup job completed', { jobId: job.id });
});

cleanupWorker.on('failed', (job, err) => {
  logger.error('Cleanup job failed', { jobId: job.id, error: err.message });
});

module.exports = cleanupWorker;
