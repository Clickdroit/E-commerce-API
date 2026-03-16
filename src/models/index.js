const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    logger.info('Database schema initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize database schema', { error: err.message });
    throw err;
  }
}

module.exports = { initializeDatabase };
