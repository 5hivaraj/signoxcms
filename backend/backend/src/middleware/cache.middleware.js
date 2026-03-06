const cacheService = require('../services/cache.service');

/**
 * Caching middleware for API responses
 */

// Generic cache middleware
const cache = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = null,
    condition = null,
    skipCache = false
  } = options;

  return async (req, res, next) => {
    if (skipCache || req.method !== 'GET') {
      return next();
    }

    // Check if client requested no-cache
    const cacheControl = req.get('Cache-Control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      console.log('⚠️ Client requested no-cache, skipping cache for:', req.path);
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator ? 
        keyGenerator(req) : 
        generateDefaultCacheKey(req);

      // Check condition if provided
      if (condition && !condition(req)) {
        return next();
      }

      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        console.log(`✅ Cache HIT for ${req.path}, type: ${typeof cachedData}, isString: ${typeof cachedData === 'string'}`);
        
        // Add cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
          'Content-Type': 'application/json'
        });
        
        // If cachedData is a string (shouldn't happen but let's handle it), parse it first
        const dataToSend = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        return res.json(dataToSend);
      }

      // Cache miss - intercept response
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data) {
        cacheResponse(cacheKey, data, ttl, res.statusCode);
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`
        });
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        cacheResponse(cacheKey, data, ttl, res.statusCode);
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`
        });
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Cache middleware error:', error);
      next();
    }
  };
};

// Cache response helper
const cacheResponse = async (key, data, ttl, statusCode) => {
  // Only cache successful responses
  if (statusCode >= 200 && statusCode < 300) {
    try {
      await cacheService.set(key, data, ttl);
    } catch (error) {
      console.error('❌ Failed to cache response:', error);
    }
  }
};

// Generate default cache key
const generateDefaultCacheKey = (req) => {
  const userId = req.user ? req.user.id : 'anonymous';
  const userRole = req.user ? req.user.role : 'guest';
  const path = req.path;
  const query = JSON.stringify(req.query);
  
  return cacheService.generateKey('api', userId, userRole, path, query);
};

// Specific cache middleware for different endpoints

// Media cache (shorter TTL for better freshness)
const cacheMedia = cache({
  ttl: 300, // 5 minutes (reduced from 1 hour)
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    return cacheService.generateKey('media', userId, req.path, JSON.stringify(req.query));
  },
  condition: (req) => req.method === 'GET'
});

// Playlist cache
const cachePlaylist = cache({
  ttl: 600, // 10 minutes
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const playlistId = req.params.id || 'all';
    return cacheService.generateKey('playlist', userId, playlistId, JSON.stringify(req.query));
  }
});

// Layout cache
const cacheLayout = cache({
  ttl: 600, // 10 minutes
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const layoutId = req.params.id || 'all';
    return cacheService.generateKey('layout', userId, layoutId, JSON.stringify(req.query));
  }
});

// Display cache
const cacheDisplay = cache({
  ttl: 300, // 5 minutes
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const displayId = req.params.id || 'all';
    return cacheService.generateKey('display', userId, displayId, JSON.stringify(req.query));
  }
});

// User cache (shorter TTL for sensitive data)
const cacheUser = cache({
  ttl: 180, // 3 minutes
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const targetUserId = req.params.id || 'all';
    return cacheService.generateKey('user', userId, targetUserId, JSON.stringify(req.query));
  },
  condition: (req) => req.user && req.user.role !== 'STAFF' // Don't cache for staff
});

// Analytics cache (very short TTL)
const cacheAnalytics = cache({
  ttl: 60, // 1 minute
  keyGenerator: (req) => {
    const userId = req.user ? req.user.id : 'anonymous';
    const timeRange = req.query.timeRange || 'day';
    return cacheService.generateKey('analytics', userId, timeRange, JSON.stringify(req.query));
  }
});

// Cache invalidation middleware
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    const invalidatePatterns = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          const resolvedPattern = typeof pattern === 'function' ? pattern(req) : pattern;
          await cacheService.invalidatePattern(resolvedPattern);
        }
      }
    };
    
    res.send = function(data) {
      invalidatePatterns();
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      invalidatePatterns();
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Specific invalidation patterns
const invalidateMediaCache = invalidateCache([
  (req) => 'signox:media:*',
  (req) => 'signox:playlist:*', // Media changes affect playlists
  (req) => 'signox:layout:*'    // Media changes affect layouts
]);

const invalidatePlaylistCache = invalidateCache([
  (req) => 'signox:playlist:*',
  (req) => 'signox:display:*'   // Playlist changes affect displays
]);

const invalidateLayoutCache = invalidateCache([
  (req) => 'signox:layout:*',
  (req) => 'signox:display:*'   // Layout changes affect displays
]);

const invalidateDisplayCache = invalidateCache([
  (req) => 'signox:display:*'
]);

const invalidateUserCache = invalidateCache([
  (req) => 'signox:user:*'
]);

// Cache warming functions
const warmCache = {
  async media(userId) {
    // Pre-load frequently accessed media
    console.log(`🔥 Warming media cache for user ${userId}`);
    // Implementation would fetch and cache common media queries
  },
  
  async playlists(userId) {
    console.log(`🔥 Warming playlist cache for user ${userId}`);
    // Implementation would fetch and cache user's playlists
  },
  
  async layouts(userId) {
    console.log(`🔥 Warming layout cache for user ${userId}`);
    // Implementation would fetch and cache user's layouts
  }
};

module.exports = {
  cache,
  cacheMedia,
  cachePlaylist,
  cacheLayout,
  cacheDisplay,
  cacheUser,
  cacheAnalytics,
  invalidateMediaCache,
  invalidatePlaylistCache,
  invalidateLayoutCache,
  invalidateDisplayCache,
  invalidateUserCache,
  warmCache
};