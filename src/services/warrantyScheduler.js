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
        try {
          await this.runCheck('scheduled');
        } catch (error) {
          console.error('❌ Scheduled warranty check failed:', error.message);
        }
      }, {
        scheduled: false,
        timezone: "Europe/Lisbon"
      });

      this.cronJob.start();
      this.isRunning = true;

      console.log('✅ Warranty scheduler started - daily at 8:00 AM (Europe/Lisbon)');

      // Run an initial check after 10 seconds (reduced from 30)
      setTimeout(async () => {
        try {
          await this.runCheck('startup');
        } catch (error) {
          console.error('❌ Startup warranty check failed:', error.message);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Failed to start warranty scheduler:', error);
      this.isRunning = false;
    }
  }

  async runCheck(trigger = 'manual') {
    this.lastCheck = new Date();

    try {
      const result = await WarrantyController.checkWarrantyExpiration();
      this.lastResult = result;

      if (result && (result.expired > 0 || result.expiring > 0)) {
        console.log(`⚠️ ${trigger} warranty check: ${result.expiring} expiring, ${result.expired} expired items (${result.notifications_created} notifications created)`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Error in ${trigger} warranty check:`, error);
      this.lastResult = { error: error.message };
      return { error: error.message, expired: 0, expiring: 0, notifications_created: 0 };
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
    try {
      return await this.runCheck('manual');
    } catch (error) {
      console.error('❌ Manual warranty check failed:', error.message);
      return { error: error.message, expired: 0, expiring: 0, notifications_created: 0 };
    }
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

// Graceful shutdown handling - only for direct process signals
process.on('SIGINT', () => {
  console.log('🛑 Shutting down warranty scheduler...');
  warrantyScheduler.stop();
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down warranty scheduler...');
  warrantyScheduler.stop();
});

module.exports = warrantyScheduler;
