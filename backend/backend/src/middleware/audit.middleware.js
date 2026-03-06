const auditService = require('../services/audit.service');

/**
 * Audit logging middleware for tracking user actions and data changes
 */

// Middleware to audit all requests
const auditRequest = (req, res, next) => {
  // Skip audit for health checks and static files
  const skipPaths = ['/health', '/uploads', '/favicon.ico'];
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path));
  
  if (shouldSkip) {
    return next();
  }

  // Capture original response methods to log after completion
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    logRequestCompletion(req, res, data);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    logRequestCompletion(req, res, data);
    return originalJson.call(this, data);
  };
  
  next();
};

// Log request completion
const logRequestCompletion = async (req, res, responseData) => {
  // Only log successful operations that modify data
  if (res.statusCode >= 400) return;
  
  const method = req.method;
  const path = req.path;
  
  // Determine action type
  let action = null;
  if (method === 'POST') action = 'CREATE';
  else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
  else if (method === 'DELETE') action = 'DELETE';
  else if (method === 'GET' && path.includes('/download')) action = 'DOWNLOAD';
  
  if (!action) return; // Skip GET requests that don't download
  
  // Extract entity type from path
  const entityType = extractEntityType(path);
  if (!entityType) return;
  
  try {
    await auditService.logUserAction(`${entityType}_${action}`, {
      entityType,
      endpoint: path,
      method,
      statusCode: res.statusCode,
      requestBody: sanitizeRequestBody(req.body),
      responseSize: JSON.stringify(responseData).length
    }, req);
  } catch (error) {
    console.error('❌ Audit logging failed:', error);
  }
};

// Extract entity type from API path
const extractEntityType = (path) => {
  const pathSegments = path.split('/').filter(segment => segment);
  
  // Map API paths to entity types
  const entityMap = {
    'users': 'USER',
    'displays': 'DISPLAY',
    'media': 'MEDIA',
    'playlists': 'PLAYLIST',
    'layouts': 'LAYOUT',
    'schedules': 'SCHEDULE',
    'auth': 'AUTH',
    'admin': 'ADMIN'
  };
  
  for (const segment of pathSegments) {
    if (entityMap[segment]) {
      return entityMap[segment];
    }
  }
  
  return null;
};

// Sanitize request body for logging (remove sensitive data)
const sanitizeRequestBody = (body) => {
  if (!body) return null;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Middleware specifically for authentication events
const auditAuth = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log authentication events
    if (req.path.includes('/login')) {
      const success = res.statusCode === 200;
      auditService.logAuthEvent(success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED', {
        email: req.body.email,
        success,
        statusCode: res.statusCode
      }, req);
    } else if (req.path.includes('/logout')) {
      auditService.logAuthEvent('LOGOUT', {
        statusCode: res.statusCode
      }, req);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware for sensitive operations
const auditSensitiveOperation = (operationType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode < 400) {
        auditService.logUserAction(`SENSITIVE_${operationType}`, {
          operation: operationType,
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          details: sanitizeRequestBody(req.body)
        }, req);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware for data export operations
const auditDataExport = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200) {
      auditService.logUserAction('DATA_EXPORT', {
        endpoint: req.path,
        exportType: req.query.type || 'unknown',
        recordCount: Array.isArray(data) ? data.length : 1,
        fileSize: JSON.stringify(data).length
      }, req);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware for admin operations
const auditAdminOperation = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode < 400) {
      auditService.logUserAction('ADMIN_OPERATION', {
        operation: `${req.method} ${req.path}`,
        adminRole: req.user ? req.user.role : 'unknown',
        targetUser: req.body.userId || req.params.userId,
        details: sanitizeRequestBody(req.body)
      }, req);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware for file operations
const auditFileOperation = (operationType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode < 400) {
        auditService.logUserAction(`FILE_${operationType}`, {
          operation: operationType,
          fileName: req.file ? req.file.originalname : req.body.fileName,
          fileSize: req.file ? req.file.size : null,
          mimeType: req.file ? req.file.mimetype : null,
          endpoint: req.path
        }, req);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  auditRequest,
  auditAuth,
  auditSensitiveOperation,
  auditDataExport,
  auditAdminOperation,
  auditFileOperation
};