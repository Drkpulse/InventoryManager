// src/services/warrantyScheduler.js - Automated warranty checking service
const cron = require('node-cron');
const { checkWarrantyExpiration } = require('../controllers/notificationController');

class WarrantyScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  start() {
    if (this.isRunning) {
      console.log('Warranty scheduler is already running');
      return;
    }

    try {
      // Run every day at 8:00 AM
      this.cronJob = cron.schedule('0 8 * * *', async () => {
        console.log('🔍 Running automated warranty expiration check...');
        try {
          const result = await checkWarrantyExpiration();
          if (result) {
            console.log(`✅ Warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
          } else {
            console.log('⚠️ Warranty check completed with errors');
          }
        } catch (error) {
          console.error('❌ Error in scheduled warranty check:', error);
        }
      }, {
        scheduled: false,
        timezone: "America/New_York" // Adjust timezone as needed
      });

      this.cronJob.start();
      this.isRunning = true;

      console.log('✅ Warranty scheduler started successfully');
      console.log('📅 Scheduled to run daily at 8:00 AM');

      // Run an initial check after 30 seconds
      setTimeout(async () => {
        console.log('🚀 Running initial warranty check...');
        try {
          const result = await checkWarrantyExpiration();
          if (result) {
            console.log(`✅ Initial warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
          }
        } catch (error) {
          console.error('❌ Error in initial warranty check:', error);
        }
      }, 30000);

    } catch (error) {
      console.error('❌ Failed to start warranty scheduler:', error);
      this.isRunning = false;
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
      nextRun: this.cronJob ? 'Daily at 8:00 AM' : null,
      lastCheck: null // Could be enhanced to track last run time
    };
  }

  // Manual trigger for testing/admin use
  async runNow() {
    console.log('🔧 Manually triggering warranty check...');
    try {
      const result = await checkWarrantyExpiration();
      console.log(`✅ Manual warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
      return result;
    } catch (error) {
      console.error('❌ Error in manual warranty check:', error);
      throw error;
    }
  }
}

// Create singleton instance
const warrantyScheduler = new WarrantyScheduler();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down warranty scheduler...');
  warrantyScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down warranty scheduler...');
  warrantyScheduler.stop();
  process.exit(0);
});

module.exports = warrantyScheduler;
