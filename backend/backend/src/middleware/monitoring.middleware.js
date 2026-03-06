const healthService = require('../services/health.service');

/**
 * Request monitoring and metrics collection middleware
 */

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Only log in development and only for non-polling endpoints
  const isPollingEndpoint = req.path.includes('/heartbeat') || 
                           req.path.includes('/config') || 
                           req.path.includes('/check-status');

  // Override res.end to capture response time and status
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    
    // Record metrics
    healthService.recordRequest(duration, isError);
    
    // Only log errors or non-polling requests in development
    if (process.env.NODE_ENV !== 'production' && (!isPollingEndpoint || isError)) {
      const timestamp = new Date().toISOString();
      const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
      console.log(`${statusEmoji} ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime.bigint();
  
  // Override res.end to capture timing before response is sent
  const originalEnd = res.end;
  res.end = function(...args) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    const slowRequestThreshold = 1000; // 1 second
    if (duration > slowRequestThreshold) {
      console.warn(`🐌 Slow request detected: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    }
    
    // Add performance headers before sending response
    try {
      if (!res.headersSent) {
        res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      }
    } catch (error) {
      // Ignore header setting errors
    }
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
  const memoryBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const memoryAfter = process.memoryUsage();
    const memoryDiff = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      external: memoryAfter.external - memoryBefore.external
    };
    
    // Log significant memory increases
    const significantIncrease = 10 * 1024 * 1024; // 10MB
    if (memoryDiff.heapUsed > significantIncrease) {
      console.warn(`🧠 Memory increase detected: ${req.method} ${req.path} - ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  });
  
  next();
};

// Rate limiting monitoring
const rateLimitMonitor = (req, res, next) => {
  // Add rate limit headers if available
  if (req.rateLimit) {
    try {
      if (!res.headersSent) {
        res.set({
          'X-RateLimit-Limit': req.rateLimit.limit,
          'X-RateLimit-Remaining': req.rateLimit.remaining,
          'X-RateLimit-Reset': new Date(req.rateLimit.resetTime)
        });
      }
    } catch (error) {
      // Ignore header setting errors
    }
  }
  
  next();
};

// API usage analytics
const apiAnalytics = (req, res, next) => {
  // Track API endpoint usage
  const endpoint = req.route ? req.route.path : req.path;
  const method = req.method;
  
  // Store analytics data (in production, use a proper analytics service)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to analytics service
    // analytics.track('api_request', {
    //   endpoint,
    //   method,
    //   userAgent: req.get('User-Agent'),
    //   ip: req.ip,
    //   userId: req.user ? req.user.id : null
    // });
  }
  
  next();
};

// Security monitoring
const securityMonitor = (req, res, next) => {
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
  ];
  
  const requestData = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestData)
  );
  
  if (isSuspicious) {
    console.warn(`🚨 Suspicious request detected: ${req.method} ${req.path} from ${req.ip}`);
    // Log to security log
    const { logSecurityEvent } = require('./logging.middleware');
    logSecurityEvent('SUSPICIOUS_REQUEST', {
      endpoint: req.path,
      method: req.method,
      patterns: 'Multiple suspicious patterns detected'
    }, req);
  }
  
  next();
};

// Health check endpoint middleware
const healthCheck = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    try {
      const healthStatus = await healthService.getHealthStatus();
      
      // Set appropriate HTTP status based on health
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'warning' ? 200 : 503;
      
      res.status(statusCode).json(healthStatus);
      return;
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
      return;
    }
  }
  
  next();
};

module.exports = {
  requestLogger,
  performanceMonitor,
  memoryMonitor,
  rateLimitMonitor,
  apiAnalytics,
  securityMonitor,
  healthCheck
};