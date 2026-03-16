const Shipment = require('../models/shipment');
const Order = require('../models/order');
const { generateTrackingNumber } = require('../utils/generateTracking');
const logger = require('../utils/logger');

const shipmentService = {
  async createShipment(orderId, carrier = 'default_carrier') {
    const trackingNumber = generateTrackingNumber();
    const shipment = await Shipment.create({ orderId, trackingNumber, carrier });
    await Order.updateStatus(orderId, 'shipped');
    logger.info('Shipment created', { orderId, trackingNumber, shipmentId: shipment.id });
    return shipment;
  },

  async updateShipmentStatus(shipmentId, status) {
    const additionalFields = {};

    if (status === 'shipped') {
      additionalFields.shipped_at = new Date().toISOString();
      additionalFields.estimated_delivery = new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000 // 5 days from now
      ).toISOString();
    }

    if (status === 'delivered') {
      additionalFields.delivered_at = new Date().toISOString();
    }

    const shipment = await Shipment.updateStatus(shipmentId, status, additionalFields);
    logger.info('Shipment status updated', { shipmentId, status });
    return shipment;
  },

  async getTrackingInfo(trackingNumber) {
    const shipment = await Shipment.findByTrackingNumber(trackingNumber);
    if (!shipment) {
      throw Object.assign(new Error('Shipment not found'), { statusCode: 404, code: 'SHIPMENT_NOT_FOUND' });
    }
    return shipment;
  },
};

module.exports = shipmentService;
