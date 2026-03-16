const winston = require('winston');
const path = require('path');

const { combine, timestamp, json, colorize, simple } = winston.format;

const transports = [
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: combine(timestamp(), json()),
  }),
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: combine(timestamp(), json()),
  }),
];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports,
});

module.exports = logger;
