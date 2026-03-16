const { v4: uuidv4 } = require('uuid');

/**
 * Generates a unique tracking number in the format:
 * TRK-<FIRST_8_CHARS_OF_UUID>-<TIMESTAMP>
 */
function generateTrackingNumber() {
  const uuidPart = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `TRK-${uuidPart}-${timestamp}`;
}

module.exports = { generateTrackingNumber };
