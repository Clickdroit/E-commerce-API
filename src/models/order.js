const { query, pool } = require('../config/database');

const Order = {
  async findById(id) {
    const orderResult = await query(
      `SELECT o.*, u.email as user_email, u.first_name, u.last_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );
    if (!orderResult.rows[0]) return null;

    const itemsResult = await query(
      `SELECT oi.*, p.name as product_name, p.sku
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    return { ...orderResult.rows[0], items: itemsResult.rows };
  },

  async findByUserId(userId) {
    const result = await query(
      `SELECT o.*,
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'product_id', oi.product_id,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'subtotal', oi.subtotal
                )
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  async create({ userId, items, totalAmount }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_amount)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, totalAmount]
      );
      const order = orderResult.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.productId, item.quantity, item.unitPrice, item.subtotal]
        );
      }

      await client.query('COMMIT');

      return this.findById(order.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateStatus(id, status) {
    const result = await query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  },

  async updatePaymentIntent(id, paymentIntentId) {
    const result = await query(
      `UPDATE orders SET stripe_payment_intent_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [paymentIntentId, id]
    );
    return result.rows[0] || null;
  },

  async findByPaymentIntentId(paymentIntentId) {
    const result = await query(
      'SELECT * FROM orders WHERE stripe_payment_intent_id = $1',
      [paymentIntentId]
    );
    return result.rows[0] || null;
  },
};

module.exports = Order;
