const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Security event logging middleware
 */

const logSecurityEvent = (event, details, req = null) => {
  const timestamp = new Date().toISOString();
  const ip = req ? (req.ip || req.connection.remoteAddress) : 'unknown';
  const userAgent = req ? req.get('User-Agent') : 'unknown';
  const userId = req && req.user ? req.user.id : 'anonymous';
  
  const logEntry = {
    timestamp,
    event,
    ip,
    userAgent,
    userId,
    details,
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // Write to security log file
  const logFile = path.join(logsDir, 'security.log');
  fs.appendFileSync(logFile, logLine);
  
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔒 Security Event: ${event}`, details);
  }
};

// Middleware to log authentication events
const logAuthEvents = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log failed login attempts
    if (req.path === '/login' && req.method === 'POST') {
      if (res.statusCode === 401) {
        logSecurityEvent('LOGIN_FAILED', {
          email: req.body.email,
          reason: 'Invalid credentials'
        }, req);
      } else if (res.statusCode === 429) {
        logSecurityEvent('LOGIN_BLOCKED', {
          email: req.body.email,
          reason: 'Rate limited'
        }, req);
      } else if (res.statusCode === 200) {
        logSecurityEvent('LOGIN_SUCCESS', {
          email: req.body.email
        }, req);
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware to log access to sensitive endpoints
const logSensitiveAccess = (req, res, next) => {
  const sensitiveEndpoints = [
    '/api/admin',
    '/api/users',
    '/api/auth/me'
  ];
  
  const isSensitive = sensitiveEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );
  
  if (isSensitive) {
    logSecurityEvent('SENSITIVE_ACCESS', {
      endpoint: req.path,
      method: req.method,
      userRole: req.user ? req.user.role : 'anonymous'
    }, req);
  }
  
  next();
};

// Middleware to log suspicious activities
const logSuspiciousActivity = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log 403 Forbidden responses
    if (res.statusCode === 403) {
      logSecurityEvent('ACCESS_DENIED', {
        endpoint: req.path,
        method: req.method,
        userRole: req.user ? req.user.role : 'anonymous'
      }, req);
    }
    
    // Log 401 Unauthorized responses
    if (res.statusCode === 401) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', {
        endpoint: req.path,
        method: req.method
      }, req);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  logSecurityEvent,
  logAuthEvents,
  logSensitiveAccess,
  logSuspiciousActivity,
};