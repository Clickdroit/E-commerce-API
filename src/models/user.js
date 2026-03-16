const { query } = require('../config/database');

const User = {
  async findById(id) {
    const result = await query(
      'SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  async create({ email, passwordHash, firstName, lastName }) {
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, role, created_at, updated_at`,
      [email, passwordHash, firstName, lastName]
    );
    return result.rows[0];
  },

  async updateRefreshToken(userId, token) {
    const result = await query(
      `UPDATE users SET refresh_token = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role`,
      [token, userId]
    );
    return result.rows[0];
  },

  async findByRefreshToken(token) {
    const result = await query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE refresh_token = $1',
      [token]
    );
    return result.rows[0] || null;
  },
};

module.exports = User;
