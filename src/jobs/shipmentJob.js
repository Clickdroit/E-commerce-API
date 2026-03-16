const { Worker } = require('bullmq');
const { connection } = require('./queue');
const Shipment = require('../models/shipment');
const shipmentService = require('../services/shipmentService');
const logger = require('../utils/logger');

const shipmentWorker = new Worker(
  'shipments',
  async (job) => {
    const { type } = job.data;

    switch (type) {
      case 'update-status': {
        const { shipmentId, status } = job.data;
        const updated = await shipmentService.updateShipmentStatus(shipmentId, status);
        logger.info('Shipment status updated via job', { shipmentId, status, jobId: job.id });
        return updated;
      }

      case 'check-delivery': {
        const { trackingNumber } = job.data;
        // Simulate carrier API check
        logger.info('Checking delivery status with carrier', { trackingNumber, jobId: job.id });
        // In production, call actual carrier API here
        const shipment = await Shipment.findByTrackingNumber(trackingNumber);
        if (shipment && shipment.status === 'in_transit') {
          logger.info('Simulated carrier check: still in transit', { trackingNumber });
        }
        break;
      }

      default:
        logger.warn('Unknown shipment job type', { type, jobId: job.id });
    }
  },
  { connection }
);

shipmentWorker.on('completed', (job) => {
  logger.debug('Shipment job completed', { jobId: job.id });
});

shipmentWorker.on('failed', (job, err) => {
  logger.error('Shipment job failed', { jobId: job.id, error: err.message });
});

module.exports = shipmentWorker;
