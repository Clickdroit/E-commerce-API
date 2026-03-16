const Joi = require('joi');
const Order = require('../models/order');
const Product = require('../models/product');
const inventoryService = require('../services/inventoryService');
const { broadcastStockUpdate } = require('../websocket/inventorySocket');
const logger = require('../utils/logger');

const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
});

async function createOrder(req, res, next) {
  try {
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) return next(error);

    const { items } = value;
    const reservedProducts = [];

    try {
      // Validate all products and reserve stock
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.is_active) {
          throw Object.assign(
            new Error(`Product ${item.productId} not found or inactive`),
            { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }
          );
        }
        const updated = await inventoryService.reserveStock(item.productId, item.quantity);
        reservedProducts.push({ product, quantity: item.quantity, updated });
        broadcastStockUpdate(product.id, updated.stock_quantity);
      }

      // Build order items
      const orderItems = reservedProducts.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
        unitPrice: parseFloat(product.price),
        subtotal: parseFloat(product.price) * quantity,
      }));

      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

      const order = await Order.create({
        userId: req.user.id,
        items: orderItems,
        totalAmount,
      });

      logger.info('Order created', { orderId: order.id, userId: req.user.id, totalAmount });
      return res.status(201).json({ success: true, data: { order } });
    } catch (err) {
      // Release any reserved stock on failure
      for (const { product, quantity } of reservedProducts) {
        try {
          const released = await inventoryService.releaseStock(product.id, quantity);
          broadcastStockUpdate(product.id, released.stock_quantity);
        } catch (releaseErr) {
          logger.error('Failed to release stock during order rollback', {
            productId: product.id,
            error: releaseErr.message,
          });
        }
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
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

    return res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await Order.findByUserId(req.user.id);
    return res.json({ success: true, data: { orders } });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
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
        error: { message: `Cannot cancel order with status: ${order.status}`, code: 'INVALID_STATUS' },
      });
    }

    const cancelled = await Order.updateStatus(order.id, 'cancelled');

    // Release stock for each item
    for (const item of order.items) {
      try {
        const released = await inventoryService.releaseStock(item.product_id, item.quantity);
        broadcastStockUpdate(item.product_id, released.stock_quantity);
      } catch (releaseErr) {
        logger.error('Failed to release stock on cancellation', {
          productId: item.product_id,
          error: releaseErr.message,
        });
      }
    }

    logger.info('Order cancelled', { orderId: order.id, userId: req.user.id });
    return res.json({ success: true, data: { order: cancelled } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, getOrder, listOrders, cancelOrder };
