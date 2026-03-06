const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Global error handling middleware
 */

class ErrorHandler extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Log error to file
const logError = (error, req = null) => {
  const timestamp = new Date().toISOString();
  const ip = req ? (req.ip || req.connection.remoteAddress) : 'unknown';
  const userAgent = req ? req.get('User-Agent') : 'unknown';
  const userId = req && req.user ? req.user.id : 'anonymous';
  const endpoint = req ? `${req.method} ${req.path}` : 'unknown';
  
  const errorLog = {
    timestamp,
    level: 'ERROR',
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    isOperational: error.isOperational || false,
    request: {
      ip,
      userAgent,
      userId,
      endpoint,
      body: req && req.body ? JSON.stringify(req.body) : null
    }
  };
  
  const logLine = JSON.stringify(errorLog) + '\n';
  
  // Write to error log file
  const errorLogFile = path.join(logsDir, 'error.log');
  fs.appendFileSync(errorLogFile, logLine);
  
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', error.message);
    console.error('📍 Stack:', error.stack);
  }
};

// Send error notification (email, Slack, etc.)
const sendErrorNotification = async (error, req = null) => {
  // Only send notifications for critical errors in production
  if (process.env.NODE_ENV !== 'production') return;
  
  if (!error.isOperational && error.statusCode >= 500) {
    // TODO: Implement email/Slack notification
    console.log('🚨 Critical error notification would be sent:', error.message);
  }
};

// Handle different types of errors
const handleCastError = (error) => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new ErrorHandler(message, 400);
};

const handleDuplicateFieldsError = (error) => {
  const value = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new ErrorHandler(message, 400);
};

const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(val => val.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new ErrorHandler(message, 400);
};

const handleJWTError = () => {
  return new ErrorHandler('Invalid token. Please log in again!', 401);
};

const handleJWTExpiredError = () => {
  return new ErrorHandler('Your token has expired! Please log in again.', 401);
};

// Send error response to client
const sendErrorDev = (err, req, res) => {
  // Development - send full error details
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: err.timestamp
  });
};

const sendErrorProd = (err, req, res) => {
  // Production - only send operational errors to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      timestamp: err.timestamp
    });
  } else {
    // Programming or unknown error - don't leak details
    console.error('ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    });
  }
};

// Main error handling middleware
const globalErrorHandler = async (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error
  logError(err, req);
  
  // Send error notification for critical errors
  await sendErrorNotification(err, req);

  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (error.name === 'CastError') error = handleCastError(error);
  if (error.code === 11000) error = handleDuplicateFieldsError(error);
  if (error.name === 'ValidationError') error = handleValidationError(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  logError(err);
  
  // Close server gracefully
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  logError(err);
  
  // Close server gracefully
  process.exit(1);
});

module.exports = {
  ErrorHandler,
  globalErrorHandler,
  catchAsync,
  logError
};