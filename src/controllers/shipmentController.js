const Joi = require('joi');
const Shipment = require('../models/shipment');
const shipmentService = require('../services/shipmentService');
const logger = require('../utils/logger');

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('preparing', 'shipped', 'in_transit', 'delivered').required(),
});

async function getShipment(req, res, next) {
  try {
    const { orderId } = req.params;
    const shipment = await Shipment.findByOrderId(orderId);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Shipment not found for this order', code: 'SHIPMENT_NOT_FOUND' },
      });
    }
    return res.json({ success: true, data: { shipment } });
  } catch (err) {
    next(err);
  }
}

async function trackShipment(req, res, next) {
  try {
    const { trackingNumber } = req.params;
    const shipment = await Shipment.findByTrackingNumber(trackingNumber);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Tracking number not found', code: 'SHIPMENT_NOT_FOUND' },
      });
    }
    return res.json({ success: true, data: { shipment } });
  } catch (err) {
    next(err);
  }
}

async function updateShipmentStatus(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required', code: 'FORBIDDEN' },
      });
    }

    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) return next(error);

    const { id } = req.params;
    const shipment = await shipmentService.updateShipmentStatus(id, value.status);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: { message: 'Shipment not found', code: 'SHIPMENT_NOT_FOUND' },
      });
    }

    logger.info('Shipment status updated via API', { shipmentId: id, status: value.status });
    return res.json({ success: true, data: { shipment } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getShipment, trackShipment, updateShipmentStatus };
