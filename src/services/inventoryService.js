const { pool } = require('../config/database');
const logger = require('../utils/logger');

const inventoryService = {
  /**
   * Reserve stock for a product within a PostgreSQL transaction.
   * Uses SELECT FOR UPDATE to prevent concurrent over-sell.
   */
  async reserveStock(productId, quantity) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockResult = await client.query(
        'SELECT id, stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (lockResult.rows.length === 0) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
      }

      const product = lockResult.rows[0];
      if (product.stock_quantity < quantity) {
        throw Object.assign(
          new Error(`Insufficient stock. Available: ${product.stock_quantity}, Requested: ${quantity}`),
          { statusCode: 400, code: 'INSUFFICIENT_STOCK' }
        );
      }

      const updated = await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [quantity, productId]
      );

      await client.query('COMMIT');
      logger.info('Stock reserved', { productId, quantity });
      return updated.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Release previously reserved stock (e.g. on order cancellation).
   */
  async releaseStock(productId, quantity) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [quantity, productId]
      );

      await client.query('COMMIT');
      logger.info('Stock released', { productId, quantity });
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = inventoryService;
