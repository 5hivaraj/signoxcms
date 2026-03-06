const cron = require('node-cron');
const { cleanupExpiredMedia } = require('../controllers/media.controller');

class CleanupService {
  constructor() {
    this.isRunning = false;
    this.jobs = [];
  }

  start() {
    if (this.isRunning) {
      return;
    }

    // Run cleanup every hour at minute 0
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      try {
        const results = await cleanupExpiredMedia();
        if (results.errors.length > 0) {
          console.error('Scheduled cleanup errors:', results.errors);
        }
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Run cleanup daily at 2 AM UTC (comprehensive cleanup)
    const dailyJob = cron.schedule('0 2 * * *', async () => {
      try {
        const results = await cleanupExpiredMedia();
        
        // Log summary for monitoring
        if (results.errors.length > 0) {
          console.warn('Daily cleanup errors:', results.errors);
        }
      } catch (error) {
        console.error('Daily cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Start the jobs
    hourlyJob.start();
    dailyJob.start();

    this.jobs = [hourlyJob, dailyJob];
    this.isRunning = true;
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.jobs.forEach(job => {
      try {
        job.stop();
        if (typeof job.destroy === 'function') {
          job.destroy();
        }
      } catch (error) {
        console.warn('Error stopping job:', error.message);
      }
    });
    
    this.jobs = [];
    this.isRunning = false;
  }

  // Manual cleanup trigger (for testing or immediate cleanup)
  async runCleanup() {
    try {
      const results = await cleanupExpiredMedia();
      return results;
    } catch (error) {
      console.error('Manual cleanup failed:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
      nextRuns: this.jobs.map(job => ({
        scheduled: job.scheduled,
        running: job.running,
      }))
    };
  }
}

// Export singleton instance
const cleanupService = new CleanupService();
module.exports = cleanupService;