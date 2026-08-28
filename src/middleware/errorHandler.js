const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`[Error Middleware] ${err.message}`, err.stack);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
