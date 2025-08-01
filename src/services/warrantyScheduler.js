// src/services/warrantyScheduler.js - Fixed automated warranty checking service
const cron = require('node-cron');
const WarrantyController = require('../controllers/warrantyController');

class WarrantyScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.lastCheck = null;
    this.lastResult = null;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Warranty scheduler is already running');
      return;
    }

    try {
      // Run every day at 8:00 AM
      this.cronJob = cron.schedule('0 8 * * *', async () => {
        await this.runCheck('scheduled');
      }, {
        scheduled: false,
        timezone: "Europe/Lisbon" // Adjust to your timezone
      });

      this.cronJob.start();
      this.isRunning = true;

      console.log('✅ Warranty scheduler started successfully');
      console.log('📅 Scheduled to run daily at 8:00 AM (Europe/Lisbon)');

      // Run an initial check after 30 seconds
      setTimeout(async () => {
        await this.runCheck('startup');
      }, 30000);

    } catch (error) {
      console.error('❌ Failed to start warranty scheduler:', error);
      this.isRunning = false;
    }
  }

  async runCheck(trigger = 'manual') {
    console.log(`🔍 Running ${trigger} warranty expiration check...`);
    this.lastCheck = new Date();

    try {
      const result = await WarrantyController.checkWarrantyExpiration();
      this.lastResult = result;

      if (result) {
        console.log(`✅ ${trigger} warranty check completed:`, {
          expired: result.expired,
          expiring: result.expiring,
          notifications: result.notifications_created,
          timestamp: this.lastCheck.toISOString()
        });
      } else {
        console.log(`⚠️ ${trigger} warranty check completed with no results`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Error in ${trigger} warranty check:`, error);
      this.lastResult = { error: error.message };
      throw error;
    }
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Warranty scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronJob ? 'Daily at 8:00 AM (Europe/Lisbon)' : null,
      lastCheck: this.lastCheck ? this.lastCheck.toISOString() : null,
      lastResult: this.lastResult,
      cronExpression: '0 8 * * *'
    };
  }

  // Manual trigger for testing/admin use
  async runNow() {
    console.log('🔧 Manually triggering warranty check...');
    return await this.runCheck('manual');
  }

  // Check if scheduler should be running (health check)
  isHealthy() {
    return {
      running: this.isRunning,
      hasJob: !!this.cronJob,
      lastCheck: this.lastCheck,
      status: this.isRunning ? 'healthy' : 'stopped'
    };
  }
}

// Create singleton instance
const warrantyScheduler = new WarrantyScheduler();

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down warranty scheduler...`);
  warrantyScheduler.stop();

  // Give some time for cleanup
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in warranty scheduler:', error);
  warrantyScheduler.stop();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in warranty scheduler:', reason);
  warrantyScheduler.stop();
});

module.exports = warrantyScheduler;
