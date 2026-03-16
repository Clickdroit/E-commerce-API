const { query } = require('../config/database');

const Shipment = {
  async create({ orderId, trackingNumber, carrier = 'default_carrier' }) {
    const result = await query(
      `INSERT INTO shipments (order_id, tracking_number, carrier)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orderId, trackingNumber, carrier]
    );
    return result.rows[0];
  },

  async findByOrderId(orderId) {
    const result = await query(
      'SELECT * FROM shipments WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0] || null;
  },

  async findByTrackingNumber(trackingNumber) {
    const result = await query(
      `SELECT s.*, o.user_id, o.status as order_status, o.total_amount
       FROM shipments s
       JOIN orders o ON s.order_id = o.id
       WHERE s.tracking_number = $1`,
      [trackingNumber]
    );
    return result.rows[0] || null;
  },

  async updateStatus(id, status, additionalFields = {}) {
    const allowedFields = ['shipped_at', 'estimated_delivery', 'delivered_at'];
    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(additionalFields)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    values.push(id);
    const result = await query(
      `UPDATE shipments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },
};

module.exports = Shipment;
