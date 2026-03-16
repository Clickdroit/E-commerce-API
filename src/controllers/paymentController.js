require('dotenv').config();
const stripe = require('../config/stripe');
const Order = require('../models/order');
const User = require('../models/user');
const paymentService = require('../services/paymentService');
const shipmentService = require('../services/shipmentService');
const inventoryService = require('../services/inventoryService');
const emailService = require('../services/emailService');
const { broadcastStockUpdate } = require('../websocket/inventorySocket');
const logger = require('../utils/logger');

async function createPaymentIntent(req, res, next) {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: { message: 'orderId is required', code: 'MISSING_ORDER_ID' },
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found', code: 'ORDER_NOT_FOUND' },
      });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied', code: 'FORBIDDEN' },
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: { message: `Order is not in pending status: ${order.status}`, code: 'INVALID_STATUS' },
      });
    }

    const paymentIntent = await paymentService.createPaymentIntent(
      parseFloat(order.total_amount),
      'eur',
      { orderId: order.id, userId: req.user.id }
    );

    await Order.updatePaymentIntent(order.id, paymentIntent.id);

    return res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function handleWebhook(req, res, next) {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).json({ success: false, error: { message: `Webhook error: ${err.message}` } });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const order = await Order.findByPaymentIntentId(paymentIntent.id);
        if (order) {
          await Order.updateStatus(order.id, 'confirmed');

          // Update charge ID if available
          if (paymentIntent.latest_charge) {
            await Order.updatePaymentIntent(order.id, paymentIntent.id);
          }

          // Create shipment
          const shipment = await shipmentService.createShipment(order.id);

          // Send confirmation email
          const user = await User.findById(order.user_id);
          if (user) {
            await emailService.sendOrderConfirmation(user, order);
            await emailService.sendShipmentNotification(user, shipment);
          }

          logger.info('Payment succeeded — order confirmed and shipment created', {
            orderId: order.id,
            shipmentId: shipment.id,
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const order = await Order.findByPaymentIntentId(paymentIntent.id);
        if (order && order.status === 'pending') {
          await Order.updateStatus(order.id, 'cancelled');

          // Release stock
          const fullOrder = await Order.findById(order.id);
          if (fullOrder && fullOrder.items) {
            for (const item of fullOrder.items) {
              try {
                const released = await inventoryService.releaseStock(item.product_id, item.quantity);
                broadcastStockUpdate(item.product_id, released.stock_quantity);
              } catch (releaseErr) {
                logger.error('Failed to release stock on payment failure', {
                  productId: item.product_id,
                  error: releaseErr.message,
                });
              }
            }
          }

          logger.info('Payment failed — order cancelled', { orderId: order.id });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.payment_intent) {
          const order = await Order.findByPaymentIntentId(charge.payment_intent);
          if (order) {
            await Order.updateStatus(order.id, 'refunded');
            logger.info('Charge refunded — order marked as refunded', { orderId: order.id });
          }
        }
        break;
      }

      default:
        logger.debug('Unhandled Stripe webhook event', { type: event.type });
    }

    return res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function refundPayment(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required', code: 'FORBIDDEN' },
      });
    }

    const { orderId } = req.params;
    const { amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { message: 'Order not found', code: 'ORDER_NOT_FOUND' },
      });
    }

    if (!order.stripe_payment_intent_id) {
      return res.status(400).json({
        success: false,
        error: { message: 'No payment found for this order', code: 'NO_PAYMENT' },
      });
    }

    // Resolve actual charge ID — Stripe refunds require a charge ID, not a payment intent ID
    let chargeId = order.stripe_charge_id;
    if (!chargeId) {
      const paymentIntent = await paymentService.confirmPayment(order.stripe_payment_intent_id);
      chargeId = paymentIntent.latest_charge;
      if (!chargeId) {
        return res.status(400).json({
          success: false,
          error: { message: 'No charge found for this payment intent', code: 'NO_CHARGE' },
        });
      }
    }

    const refund = await paymentService.createRefund(chargeId, amount);

    logger.info('Refund created', { orderId, refundId: refund.id });
    return res.json({ success: true, data: { refund } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPaymentIntent, handleWebhook, refundPayment };
