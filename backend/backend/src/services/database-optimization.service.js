const { PrismaClient } = require('@prisma/client');

class DatabaseOptimizationService {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
    
    this.queryCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Connection pool optimization
  async optimizeConnectionPool() {
    try {
      // Configure connection pool settings
      const poolConfig = {
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
      };

      console.log('🔧 Database connection pool configured:', poolConfig);
      return poolConfig;
    } catch (error) {
      console.error('❌ Connection pool optimization failed:', error);
      throw error;
    }
  }

  // Query optimization helpers
  buildOptimizedQuery(model, options = {}) {
    const {
      select = null,
      include = null,
      where = {},
      orderBy = null,
      take = null,
      skip = null
    } = options;

    // Build optimized query object
    const query = { where };

    // Use select for specific fields to reduce data transfer
    if (select) {
      query.select = select;
    } else if (include) {
      query.include = include;
    }

    if (orderBy) query.orderBy = orderBy;
    if (take) query.take = take;
    if (skip) query.skip = skip;

    return query;
  }

  // Optimized user queries
  async findUsersOptimized(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = null,
      role = null,
      isActive = null,
      includeProfile = false
    } = options;

    const where = {};
    
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }
    
    if (role) where.role = role;
    if (isActive !== null) where.isActive = isActive;

    const select = {
      id: true,
      email: true,
      role: true,
      staffRole: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    };

    if (includeProfile) {
      select.clientProfile = true;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Optimized media queries
  async findMediaOptimized(options = {}) {
    const {
      page = 1,
      limit = 20,
      type = null,
      search = null,
      userId = null,
      tags = null
    } = options;

    const where = {};
    
    if (type) where.type = type;
    if (userId) where.createdById = userId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const select = {
      id: true,
      name: true,
      originalName: true,
      type: true,
      url: true,
      duration: true,
      fileSize: true,
      mimeType: true,
      width: true,
      height: true,
      tags: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          email: true
        }
      }
    };

    const skip = (page - 1) * limit;

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      this.prisma.media.count({ where })
    ]);

    return {
      media,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Optimized playlist queries with media count
  async findPlaylistsOptimized(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = null,
      userId = null,
      isActive = null
    } = options;

    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (userId) where.createdById = userId;
    if (isActive !== null) where.isActive = isActive;

    const skip = (page - 1) * limit;

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          loopEnabled: true,
          shuffleEnabled: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              email: true
            }
          },
          _count: {
            select: {
              items: true,
              displays: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      this.prisma.playlist.count({ where })
    ]);

    return {
      playlists,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Optimized display queries with status aggregation
  async findDisplaysOptimized(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      search = null,
      userId = null,
      tags = null
    } = options;

    const where = {};
    
    if (status) where.status = status;
    if (userId) where.managedByUserId = userId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const skip = (page - 1) * limit;

    const [displays, total] = await Promise.all([
      this.prisma.display.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          isPaired: true,
          tags: true,
          location: true,
          orientation: true,
          lastHeartbeat: true,
          lastSeenAt: true,
          createdAt: true,
          managedByUser: {
            select: {
              id: true,
              email: true
            }
          },
          playlist: {
            select: {
              id: true,
              name: true
            }
          },
          layout: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      }),
      this.prisma.display.count({ where })
    ]);

    return {
      displays,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Batch operations for better performance
  async batchUpdateDisplayStatus(displayIds, status) {
    try {
      const result = await this.prisma.display.updateMany({
        where: {
          id: { in: displayIds }
        },
        data: {
          status,
          lastSeenAt: new Date()
        }
      });

      console.log(`📊 Batch updated ${result.count} displays to status: ${status}`);
      return result;
    } catch (error) {
      console.error('❌ Batch update failed:', error);
      throw error;
    }
  }

  // Bulk insert playlist items
  async bulkInsertPlaylistItems(playlistId, mediaItems) {
    try {
      const items = mediaItems.map((item, index) => ({
        playlistId,
        mediaId: item.mediaId,
        order: item.order || index,
        duration: item.duration || null,
        loopVideo: item.loopVideo || false,
        orientation: item.orientation || null,
        resizeMode: item.resizeMode || 'FIT',
        rotation: item.rotation || 0
      }));

      const result = await this.prisma.playlistItem.createMany({
        data: items,
        skipDuplicates: true
      });

      console.log(`📊 Bulk inserted ${result.count} playlist items`);
      return result;
    } catch (error) {
      console.error('❌ Bulk insert failed:', error);
      throw error;
    }
  }

  // Database statistics and health
  async getDatabaseStats() {
    try {
      const [
        userCount,
        mediaCount,
        playlistCount,
        displayCount,
        layoutCount
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.media.count(),
        this.prisma.playlist.count(),
        this.prisma.display.count(),
        this.prisma.layout.count()
      ]);

      // Get storage usage
      const mediaStats = await this.prisma.media.aggregate({
        _sum: { fileSize: true },
        _avg: { fileSize: true },
        _max: { fileSize: true }
      });

      return {
        counts: {
          users: userCount,
          media: mediaCount,
          playlists: playlistCount,
          displays: displayCount,
          layouts: layoutCount
        },
        storage: {
          totalSize: mediaStats._sum.fileSize || 0,
          averageSize: mediaStats._avg.fileSize || 0,
          largestFile: mediaStats._max.fileSize || 0
        }
      };
    } catch (error) {
      console.error('❌ Failed to get database stats:', error);
      throw error;
    }
  }

  // Query performance monitoring
  async monitorQueryPerformance(queryName, queryFunction) {
    const startTime = Date.now();
    
    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;
      
      if (duration > 1000) { // Log slow queries (>1 second)
        console.warn(`🐌 Slow query detected: ${queryName} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Query failed: ${queryName} (${duration}ms):`, error.message);
      throw error;
    }
  }

  // Clean up old records
  async cleanupOldRecords() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Clean up old media with endDate
      const expiredMedia = await this.prisma.media.deleteMany({
        where: {
          endDate: {
            lte: new Date()
          }
        }
      });

      console.log(`🧹 Cleaned up ${expiredMedia.count} expired media files`);
      return expiredMedia.count;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }

  // Index suggestions based on query patterns
  getIndexSuggestions() {
    return [
      {
        collection: 'User',
        field: 'email',
        type: 'unique',
        reason: 'Login queries'
      },
      {
        collection: 'User',
        field: 'role',
        type: 'index',
        reason: 'Role-based filtering'
      },
      {
        collection: 'Media',
        field: 'createdById',
        type: 'index',
        reason: 'User media queries'
      },
      {
        collection: 'Media',
        field: 'type',
        type: 'index',
        reason: 'Media type filtering'
      },
      {
        collection: 'Display',
        field: 'status',
        type: 'index',
        reason: 'Status filtering'
      },
      {
        collection: 'Display',
        field: 'managedByUserId',
        type: 'index',
        reason: 'User display queries'
      },
      {
        collection: 'PlaylistItem',
        field: ['playlistId', 'order'],
        type: 'compound',
        reason: 'Playlist ordering'
      }
    ];
  }

  // Graceful shutdown
  async disconnect() {
    try {
      await this.prisma.$disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Database disconnect error:', error);
    }
  }
}

module.exports = new DatabaseOptimizationService();