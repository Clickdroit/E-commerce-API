const { emailQueue, shipmentQueue } = require('../jobs/queue');
const logger = require('../utils/logger');

const emailService = {
  async sendOrderConfirmation(user, order) {
    await emailQueue.add('order-confirmation', {
      type: 'order-confirmation',
      to: user.email,
      subject: `Order Confirmation #${order.id}`,
      user: { id: user.id, email: user.email, firstName: user.first_name },
      order: { id: order.id, totalAmount: order.total_amount, status: order.status },
    });
    logger.info('Order confirmation email queued', { userId: user.id, orderId: order.id });
  },

  async sendShipmentNotification(user, shipment) {
    await emailQueue.add('shipment-notification', {
      type: 'shipment-notification',
      to: user.email,
      subject: `Your order has shipped! Tracking: ${shipment.tracking_number}`,
      user: { id: user.id, email: user.email, firstName: user.first_name },
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.tracking_number,
        carrier: shipment.carrier,
        estimatedDelivery: shipment.estimated_delivery,
      },
    });
    logger.info('Shipment notification email queued', { userId: user.id, shipmentId: shipment.id });
  },
};

module.exports = emailService;
