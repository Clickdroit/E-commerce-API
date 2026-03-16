const Joi = require('joi');
const Product = require('../models/product');
const { broadcastStockUpdate } = require('../websocket/inventorySocket');
const logger = require('../utils/logger');

const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('').optional(),
  price: Joi.number().positive().precision(2).required(),
  stockQuantity: Joi.number().integer().min(0).default(0),
  sku: Joi.string().min(1).max(100).required(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  description: Joi.string().allow(''),
  price: Joi.number().positive().precision(2),
  stock_quantity: Joi.number().integer().min(0),
  sku: Joi.string().min(1).max(100),
  is_active: Joi.boolean(),
}).min(1);

const updateStockSchema = Joi.object({
  stockQuantity: Joi.number().integer().min(0).required(),
});

async function listProducts(req, res, next) {
  try {
    const { limit = 20, offset = 0, search = '' } = req.query;
    const products = await Product.findAll({ limit, offset, search });
    return res.json({ success: true, data: { products, limit: parseInt(limit, 10), offset: parseInt(offset, 10) } });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
      });
    }
    return res.json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required', code: 'FORBIDDEN' },
      });
    }

    const { error, value } = createProductSchema.validate(req.body);
    if (error) return next(error);

    const product = await Product.create(value);
    logger.info('Product created', { productId: product.id, sku: product.sku });
    return res.status(201).json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required', code: 'FORBIDDEN' },
      });
    }

    const { error, value } = updateProductSchema.validate(req.body);
    if (error) return next(error);

    const product = await Product.update(req.params.id, value);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
      });
    }

    logger.info('Product updated', { productId: product.id });
    return res.json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

async function updateStock(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required', code: 'FORBIDDEN' },
      });
    }

    const { error, value } = updateStockSchema.validate(req.body);
    if (error) return next(error);

    const product = await Product.update(req.params.id, { stock_quantity: value.stockQuantity });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
      });
    }

    broadcastStockUpdate(product.id, product.stock_quantity);
    logger.info('Stock updated', { productId: product.id, newStock: product.stock_quantity });
    return res.json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, updateStock };
