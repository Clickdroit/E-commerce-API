const { query } = require('../config/database');

const Product = {
  async findAll({ limit = 20, offset = 0, search = '' } = {}) {
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safeOffset = parseInt(offset, 10) || 0;

    let text, params;
    if (search) {
      text = `SELECT * FROM products
              WHERE is_active = TRUE
                AND (name ILIKE $1 OR description ILIKE $1 OR sku ILIKE $1)
              ORDER BY created_at DESC
              LIMIT $2 OFFSET $3`;
      params = [`%${search}%`, safeLimit, safeOffset];
    } else {
      text = `SELECT * FROM products
              WHERE is_active = TRUE
              ORDER BY created_at DESC
              LIMIT $1 OFFSET $2`;
      params = [safeLimit, safeOffset];
    }

    const result = await query(text, params);
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create({ name, description, price, stockQuantity, sku }) {
    const result = await query(
      `INSERT INTO products (name, description, price, stock_quantity, sku)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description, price, stockQuantity ?? 0, sku]
    );
    return result.rows[0];
  },

  async update(id, fields) {
    const allowedFields = ['name', 'description', 'price', 'stock_quantity', 'sku', 'is_active'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async decrementStock(id, quantity, client) {
    const db = client || { query: (text, params) => query(text, params) };
    const result = await db.query(
      `UPDATE products
       SET stock_quantity = stock_quantity - $1, updated_at = NOW()
       WHERE id = $2 AND stock_quantity >= $1
       RETURNING *`,
      [quantity, id]
    );
    if (result.rows.length === 0) {
      throw new Error(`Insufficient stock for product ${id}`);
    }
    return result.rows[0];
  },

  async incrementStock(id, quantity, client) {
    const db = client || { query: (text, params) => query(text, params) };
    const result = await db.query(
      `UPDATE products
       SET stock_quantity = stock_quantity + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );
    return result.rows[0] || null;
  },
};

module.exports = Product;
