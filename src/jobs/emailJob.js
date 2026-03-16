const { Worker } = require('bullmq');
const { connection } = require('./queue');
const logger = require('../utils/logger');

const emailWorker = new Worker(
  'emails',
  async (job) => {
    const { type, to, subject } = job.data;

    logger.info('Sending email', { type, to, subject, jobId: job.id });

    switch (type) {
      case 'order-confirmation':
        logger.info('Order confirmation email sent', {
          to,
          orderId: job.data.order?.id,
        });
        break;

      case 'shipment-notification':
        logger.info('Shipment notification email sent', {
          to,
          trackingNumber: job.data.shipment?.trackingNumber,
        });
        break;

      default:
        logger.warn('Unknown email job type', { type, jobId: job.id });
    }
  },
  { connection }
);

emailWorker.on('completed', (job) => {
  logger.debug('Email job completed', { jobId: job.id });
});

emailWorker.on('failed', (job, err) => {
  logger.error('Email job failed', { jobId: job.id, error: err.message });
});

module.exports = emailWorker;
