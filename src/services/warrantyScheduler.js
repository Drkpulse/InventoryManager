// src/services/warrantyScheduler.js

const cron = require('node-cron');
const { checkWarrantyExpiration } = require('../controllers/notificationController');

class WarrantyScheduler {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Warranty scheduler is already running');
      return;
    }

    // Run warranty check daily at 9:00 AM
    this.dailyCheck = cron.schedule('0 9 * * *', async () => {
      console.log('Running daily warranty expiration check...');
      try {
        const result = await checkWarrantyExpiration();
        if (result) {
          console.log(`Daily warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
        }
      } catch (error) {
        console.error('Error in daily warranty check:', error);
      }
    }, {
      scheduled: false,
      timezone: "Europe/Lisbon"
    });

    // Run warranty check on startup (after 30 seconds delay)
    setTimeout(async () => {
      console.log('Running initial warranty expiration check...');
      try {
        const result = await checkWarrantyExpiration();
        if (result) {
          console.log(`Initial warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
        }
      } catch (error) {
        console.error('Error in initial warranty check:', error);
      }
    }, 30000);

    this.dailyCheck.start();
    this.isRunning = true;
    console.log('Warranty scheduler started - daily checks at 9:00 AM');
  }

  stop() {
    if (this.dailyCheck) {
      this.dailyCheck.stop();
      this.isRunning = false;
      console.log('Warranty scheduler stopped');
    }
  }

  // Manual trigger for testing
  async runCheck() {
    console.log('Manual warranty check triggered...');
    try {
      const result = await checkWarrantyExpiration();
      if (result) {
        console.log(`Manual warranty check completed: ${result.expiring} expiring, ${result.expired} expired`);
        return result;
      }
      return null;
    } catch (error) {
      console.error('Error in manual warranty check:', error);
      return null;
    }
  }
}

module.exports = new WarrantyScheduler();
