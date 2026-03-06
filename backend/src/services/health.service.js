const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();

class HealthService {
  constructor() {
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.alertThresholds = {
      memoryUsage: 85, // Percentage
      diskUsage: 90,   // Percentage
      responseTime: 5000, // Milliseconds
      errorRate: 10    // Percentage
    };
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTimeSum: 0,
      lastReset: Date.now()
    };
  }

  // Database health check
  async checkDatabase() {
    try {
      const start = Date.now();
      // Use a simple findFirst query instead of $queryRaw for MongoDB
      await prisma.user.findFirst({ take: 1 });
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Database connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }

  // Memory usage check
  checkMemory() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercentage = (usedMemory / totalMemory) * 100;

    const processMemory = process.memoryUsage();
    
    return {
      status: usagePercentage > this.alertThresholds.memoryUsage ? 'warning' : 'healthy',
      system: {
        total: this.formatBytes(totalMemory),
        used: this.formatBytes(usedMemory),
        free: this.formatBytes(freeMemory),
        usagePercentage: Math.round(usagePercentage * 100) / 100
      },
      process: {
        rss: this.formatBytes(processMemory.rss),
        heapTotal: this.formatBytes(processMemory.heapTotal),
        heapUsed: this.formatBytes(processMemory.heapUsed),
        external: this.formatBytes(processMemory.external)
      }
    };
  }

  // Disk usage check
  checkDisk() {
    try {
      const stats = fs.statSync(process.cwd());
      const diskPath = process.cwd();
      
      // This is a simplified check - in production, use a proper disk usage library
      return {
        status: 'healthy',
        path: diskPath,
        message: 'Disk space check completed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Disk space check failed'
      };
    }
  }

  // Application metrics
  getApplicationMetrics() {
    const uptime = Date.now() - this.startTime;
    const timeSinceReset = Date.now() - this.metrics.lastReset;
    const avgResponseTime = this.metrics.requests > 0 ? 
      this.metrics.responseTimeSum / this.metrics.requests : 0;
    const errorRate = this.metrics.requests > 0 ? 
      (this.metrics.errors / this.metrics.requests) * 100 : 0;

    return {
      uptime: this.formatDuration(uptime),
      uptimeMs: uptime,
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100
      },
      resetPeriod: this.formatDuration(timeSinceReset)
    };
  }

  // CPU usage check
  getCPUUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    return {
      status: 'healthy',
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage: {
        '1min': Math.round(loadAvg[0] * 100) / 100,
        '5min': Math.round(loadAvg[1] * 100) / 100,
        '15min': Math.round(loadAvg[2] * 100) / 100
      }
    };
  }

  // File system checks
  async checkFileSystem() {
    try {
      const uploadsDir = path.join(process.cwd(), 'public/uploads');
      const logsDir = path.join(process.cwd(), 'logs');
      
      const checks = {
        uploadsDirectory: fs.existsSync(uploadsDir) ? 'accessible' : 'missing',
        logsDirectory: fs.existsSync(logsDir) ? 'accessible' : 'missing',
        writePermissions: 'unknown'
      };

      // Test write permissions
      try {
        const testFile = path.join(uploadsDir, '.health-check');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        checks.writePermissions = 'ok';
      } catch (error) {
        checks.writePermissions = 'failed';
      }

      const allHealthy = Object.values(checks).every(status => 
        status === 'accessible' || status === 'ok'
      );

      return {
        status: allHealthy ? 'healthy' : 'warning',
        checks
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // External services check (if any)
  async checkExternalServices() {
    // Add checks for external services like email, SMS, etc.
    return {
      status: 'healthy',
      services: {
        // email: await this.checkEmailService(),
        // sms: await this.checkSMSService(),
      }
    };
  }

  // Comprehensive health check
  async getHealthStatus() {
    try {
      const [
        database,
        memory,
        disk,
        cpu,
        fileSystem,
        externalServices
      ] = await Promise.all([
        this.checkDatabase(),
        Promise.resolve(this.checkMemory()),
        Promise.resolve(this.checkDisk()),
        Promise.resolve(this.getCPUUsage()),
        this.checkFileSystem(),
        this.checkExternalServices()
      ]);

      const applicationMetrics = this.getApplicationMetrics();

      const overallStatus = this.determineOverallStatus([
        database.status,
        memory.status,
        disk.status,
        cpu.status,
        fileSystem.status,
        externalServices.status
      ]);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: {
          database,
          memory,
          disk,
          cpu,
          fileSystem,
          externalServices
        },
        application: applicationMetrics,
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          hostname: os.hostname()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Determine overall health status
  determineOverallStatus(statuses) {
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  // Record request metrics
  recordRequest(responseTime, isError = false) {
    this.metrics.requests++;
    this.metrics.responseTimeSum += responseTime;
    
    if (isError) {
      this.metrics.errors++;
    }
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTimeSum: 0,
      lastReset: Date.now()
    };
  }

  // Utility functions
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Start monitoring
  start() {
    console.log('🏥 Health monitoring service started');
    
    // Log health status periodically
    setInterval(async () => {
      const health = await this.getHealthStatus();
      if (health.status !== 'healthy') {
        console.warn(`⚠️ Health Status: ${health.status.toUpperCase()}`);
      }
    }, 60000); // Check every minute
  }

  stop() {
    console.log('🏥 Health monitoring service stopped');
  }
}

module.exports = new HealthService();