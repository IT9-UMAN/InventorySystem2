const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

const logger = winston.createLogger({
  level: 'info',

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  defaultMeta: {
    service: 'node-backend'
  },

  transports: [

    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),

    // All logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })

  ]
});

// Console logs (only in development)
if (process.env.NODE_ENV !== 'production') {

  logger.add(
    new winston.transports.Console({
      format: winston.format.simple()
    })
  );

}

module.exports = logger;