require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.info('PostgreSQL client connected');
});

/**
 * Execute a SQL query using the pool.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result;
}

module.exports = { pool, query };
