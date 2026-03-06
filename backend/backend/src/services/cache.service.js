const Redis = require('ioredis');
const NodeCache = require('node-cache');

class CacheService {
  constructor() {
    this.useRedis = process.env.REDIS_URL || process.env.REDIS_HOST;
    this.defaultTTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes default
    
    if (this.useRedis) {
      this.initRedis();
    } else {
      this.initMemoryCache();
    }
  }

  initRedis() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      };

      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      } else {
        this.redis = new Redis(redisConfig);
      }

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message);
        this.fallbackToMemory();
      });

      this.cacheType = 'redis';
    } catch (error) {
      console.error('❌ Redis initialization failed:', error.message);
      this.fallbackToMemory();
    }
  }

  initMemoryCache() {
    this.memoryCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false
    });
    
    this.cacheType = 'memory';
    console.log('📦 Using in-memory cache (consider Redis for production)');
  }

  fallbackToMemory() {
    console.log('🔄 Falling back to in-memory cache');
    this.initMemoryCache();
  }

  async get(key) {
    try {
      if (this.cacheType === 'redis') {
        const value = await this.redis.get(key);
        const parsed = value ? JSON.parse(value) : null;
        if (parsed) {
          console.log(`📦 Cache GET ${key.substring(0, 50)}..., type after parse: ${typeof parsed}, isString: ${typeof parsed === 'string'}`);
        }
        return parsed;
      } else {
        return this.memoryCache.get(key) || null;
      }
    } catch (error) {
      console.error(`❌ Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const expiration = ttl || this.defaultTTL;
      console.log(`💾 Cache SET ${key.substring(0, 50)}..., value type: ${typeof value}, isString: ${typeof value === 'string'}`);
      
      if (this.cacheType === 'redis') {
        await this.redis.setex(key, expiration, JSON.stringify(value));
      } else {
        this.memoryCache.set(key, value, expiration);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  async del(key) {
    try {
      if (this.cacheType === 'redis') {
        await this.redis.del(key);
      } else {
        this.memoryCache.del(key);
      }
      return true;
    } catch (error) {
      console.error(`❌ Cache delete error for key ${key}:`, error.message);
      return false;
    }
  }

  async flush() {
    try {
      if (this.cacheType === 'redis') {
        await this.redis.flushdb();
      } else {
        this.memoryCache.flushAll();
      }
      console.log('🧹 Cache flushed successfully');
      return true;
    } catch (error) {
      console.error('❌ Cache flush error:', error.message);
      return false;
    }
  }

  async exists(key) {
    try {
      if (this.cacheType === 'redis') {
        return await this.redis.exists(key) === 1;
      } else {
        return this.memoryCache.has(key);
      }
    } catch (error) {
      console.error(`❌ Cache exists error for key ${key}:`, error.message);
      return false;
    }
  }

  async keys(pattern = '*') {
    try {
      if (this.cacheType === 'redis') {
        return await this.redis.keys(pattern);
      } else {
        return this.memoryCache.keys().filter(key => 
          pattern === '*' || key.includes(pattern.replace('*', ''))
        );
      }
    } catch (error) {
      console.error(`❌ Cache keys error for pattern ${pattern}:`, error.message);
      return [];
    }
  }

  async mget(keys) {
    try {
      if (this.cacheType === 'redis') {
        const values = await this.redis.mget(keys);
        return values.map(value => value ? JSON.parse(value) : null);
      } else {
        return keys.map(key => this.memoryCache.get(key) || null);
      }
    } catch (error) {
      console.error('❌ Cache mget error:', error.message);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs, ttl = null) {
    try {
      const expiration = ttl || this.defaultTTL;
      
      if (this.cacheType === 'redis') {
        const pipeline = this.redis.pipeline();
        
        for (const [key, value] of keyValuePairs) {
          pipeline.setex(key, expiration, JSON.stringify(value));
        }
        
        await pipeline.exec();
      } else {
        for (const [key, value] of keyValuePairs) {
          this.memoryCache.set(key, value, expiration);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Cache mset error:', error.message);
      return false;
    }
  }

  // Cache statistics
  async getStats() {
    try {
      if (this.cacheType === 'redis') {
        const info = await this.redis.info('memory');
        const keyspace = await this.redis.info('keyspace');
        
        return {
          type: 'redis',
          connected: this.redis.status === 'ready',
          memory: info,
          keyspace: keyspace
        };
      } else {
        const stats = this.memoryCache.getStats();
        return {
          type: 'memory',
          connected: true,
          keys: stats.keys,
          hits: stats.hits,
          misses: stats.misses,
          ksize: stats.ksize,
          vsize: stats.vsize
        };
      }
    } catch (error) {
      console.error('❌ Cache stats error:', error.message);
      return { type: this.cacheType, connected: false, error: error.message };
    }
  }

  // Generate cache key with prefix
  generateKey(prefix, ...parts) {
    return `signox:${prefix}:${parts.join(':')}`;
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern) {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        if (this.cacheType === 'redis') {
          await this.redis.del(...keys);
        } else {
          keys.forEach(key => this.memoryCache.del(key));
        }
        console.log(`🧹 Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      console.error(`❌ Cache invalidation error for pattern ${pattern}:`, error.message);
      return 0;
    }
  }

  // Graceful shutdown
  async disconnect() {
    try {
      if (this.cacheType === 'redis' && this.redis) {
        await this.redis.quit();
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.error('❌ Cache disconnect error:', error.message);
    }
  }
}

module.exports = new CacheService();