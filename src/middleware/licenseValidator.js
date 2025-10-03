const axios = require('axios');
const db = require('../config/db');
const cron = require('node-cron');

class LicenseValidator {
  constructor() {
    this.licenseData = null;
    this.lastCheck = null;
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.validationUrl = process.env.LICENSE_VALIDATION_URL || 'https://license.voidbyte.xyz/api/validate';
    this.dailyCheckScheduled = false;
    this.tableEnsured = false; // Track if we've already ensured the table exists
  }

  // Start daily license validation
  startDailyCheck() {
    if (this.dailyCheckScheduled) return;

    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      // Running daily license validation
      try {
        const licenseStatus = await this.checkLicense();
        // Daily license check completed

        // Log license status to database
        await this.logLicenseCheck(licenseStatus);

        // Send notification if license is expiring soon
        if (licenseStatus.valid_until) {
          const daysUntilExpiry = Math.ceil((new Date(licenseStatus.valid_until) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            console.log(`⚠️ License expires in ${daysUntilExpiry} days`);
            // TODO: Send notification to admin
          }
        }
      } catch (error) {
        console.error('❌ Daily license check failed:', error);
      }
    });

    this.dailyCheckScheduled = true;
    console.log('⏰ Daily license validation scheduled for 2:00 AM');
  }

  async logLicenseCheck(licenseStatus) {
    try {
      await db.query(`
        UPDATE license_config
        SET last_checked = CURRENT_TIMESTAMP,
            status = $1
        WHERE id = (SELECT id FROM license_config ORDER BY created_at DESC LIMIT 1)
      `, [licenseStatus.status]);
    } catch (error) {
      console.error('❌ Error logging license check:', error);
    }
  }

  async validateLicense(licenseKey) {
    // Bypass for testing with special key
    if (licenseKey === 'iambeirao') {
      console.log('⚠️ Bypass: License validation skipped for testing.');
      this.licenseData = {
        status: 'active',
        company: 'Test Company',
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        msg: 'Bypass mode: License valid for testing'
      };
      this.lastCheck = new Date();
      await this.storeLicenseInDB(licenseKey, this.licenseData);
      return this.licenseData;
    }
    try {
      // Validating license key

      // Make API call to validate license
      const response = await axios.post(this.validationUrl, {
        license_key: licenseKey,
        domain: process.env.APP_DOMAIN || 'localhost'
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const licenseData = response.data;
      this.licenseData = licenseData;
      this.lastCheck = new Date();

      // Store/update license in database
      await this.storeLicenseInDB(licenseKey, licenseData);

      // License validation successful
      return licenseData;

    } catch (error) {
      console.error('❌ License validation error:', error.message);

      // Increment validation attempts
      await this.incrementValidationAttempts(licenseKey);

      // If network error and we have recent valid license from DB, allow it
      const dbLicense = await this.getLicenseFromDB(licenseKey);
      if (dbLicense && dbLicense.status === 'active' &&
          new Date(dbLicense.last_checked) > new Date(Date.now() - this.checkInterval)) {

        // Using cached valid license from database
        this.licenseData = {
          status: dbLicense.status,
          company: dbLicense.company,
          valid_until: dbLicense.valid_until,
          msg: 'Using cached license data (network unavailable)'
        };
        return this.licenseData;
      }

      return {
        status: 'error',
        valid_until: null,
        company: null,
        msg: `Unable to validate license: ${error.message}`
      };
    }
  }

  async checkLicense() {
    try {
      // Get current license from database
      const currentLicense = await this.getCurrentLicense();

      if (!currentLicense) {
        return {
          status: 'missing',
          valid_until: null,
          company: null,
          msg: 'No license key configured'
        };
      }

      // Special handling for bypass license
      if (currentLicense.license_key === 'iambeirao') {
        console.log('⚠️ Bypass license detected, returning active status');
        this.licenseData = {
          status: 'active',
          company: 'Test Company',
          valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          msg: 'Bypass mode: License valid for testing'
        };
        return this.licenseData;
      }

      // Check if we need to revalidate
      const needsRevalidation = !currentLicense.last_checked ||
        (new Date() - new Date(currentLicense.last_checked)) > this.checkInterval;

      if (needsRevalidation) {
        // License needs revalidation
        return await this.validateLicense(currentLicense.license_key);
      }

      // Use cached data from database
      this.licenseData = {
        status: currentLicense.status,
        company: currentLicense.company,
        valid_until: currentLicense.valid_until,
        msg: 'License data from cache'
      };

      return this.licenseData;

    } catch (error) {
      console.error('❌ Error checking license:', error);
      return {
        status: 'error',
        valid_until: null,
        company: null,
        msg: 'Error checking license'
      };
    }
  }

  async getCurrentLicense() {
    try {
      // Try to ensure table exists first
      await this.ensureLicenseTable();

      const result = await db.query(`
        SELECT * FROM license_config
        ORDER BY created_at DESC
        LIMIT 1
      `);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting current license from DB:', error);
      return null;
    }
  }

  async getLicenseFromDB(licenseKey) {
    try {
      // Try to ensure table exists first
      await this.ensureLicenseTable();

      const result = await db.query(`
        SELECT * FROM license_config
        WHERE license_key = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [licenseKey]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting license from DB:', error);
      // If it's the bypass license, don't return null - let it work
      if (licenseKey === 'iambeirao') {
        console.log('🔧 Database error for bypass license, allowing operation...');
        return null; // This will trigger the insert path in storeLicenseInDB
      }
      return null;
    }
  }

  async storeLicenseInDB(licenseKey, licenseData) {
    try {
      // First, ensure the license_config table exists with all required columns
      await this.ensureLicenseTable();

      const validUntil = licenseData.valid_until ? new Date(licenseData.valid_until) : null;

      // Check if license already exists
      const existing = await this.getLicenseFromDB(licenseKey);

      if (existing) {
        // Update existing license
        await db.query(`
          UPDATE license_config
          SET company = $1,
              valid_until = $2,
              status = $3,
              last_checked = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE license_key = $4
        `, [licenseData.company, validUntil, licenseData.status, licenseKey]);

        // License updated in database
      } else {
        // Insert new license
        await db.query(`
          INSERT INTO license_config (license_key, company, valid_until, status, features)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          licenseKey,
          licenseData.company,
          validUntil,
          licenseData.status,
          JSON.stringify(licenseData.features || {})
        ]);

        // New license stored in database
      }
    } catch (error) {
      console.error('❌ Error storing license in DB:', error);
      // For critical licenses like 'iambeirao', try to create table and retry
      if (licenseKey === 'iambeirao') {
        // Attempting to fix license table for bypass license
        try {
          await this.ensureLicenseTable();
          // Retry the storage once
          const validUntil = licenseData.valid_until ? new Date(licenseData.valid_until) : null;
          await db.query(`
            INSERT INTO license_config (license_key, company, valid_until, status, features)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (license_key) DO UPDATE SET
              company = $2,
              valid_until = $3,
              status = $4,
              last_checked = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `, [
            licenseKey,
            licenseData.company,
            validUntil,
            licenseData.status,
            JSON.stringify(licenseData.features || {})
          ]);
          // Successfully stored bypass license after table fix
        } catch (retryError) {
          console.error('❌ Failed to store bypass license even after table fix:', retryError);
        }
      }
    }
  }

  async incrementValidationAttempts(licenseKey) {
    try {
      // For now, just update the last_checked timestamp
      await db.query(`
        UPDATE license_config
        SET last_checked = CURRENT_TIMESTAMP
        WHERE license_key = $1
      `, [licenseKey]);
    } catch (error) {
      console.error('❌ Error updating license timestamp:', error);
    }
  }

  async ensureLicenseTable() {
    // Skip if we've already ensured the table in this session
    if (this.tableEnsured) {
      return;
    }

    try {
      // Ensuring license_config table exists with all required columns

      // Create the table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS license_config (
          id SERIAL PRIMARY KEY,
          license_key VARCHAR(255) NOT NULL,
          company VARCHAR(255),
          valid_until TIMESTAMP,
          issued_to VARCHAR(255),
          features JSONB DEFAULT '{}',
          status VARCHAR(50) DEFAULT 'active',
          last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          validation_attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add missing columns if they don't exist
      const columns = [
        { name: 'status', type: 'VARCHAR(50)', default: "'active'" },
        { name: 'last_checked', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
        { name: 'validation_attempts', type: 'INTEGER', default: '0' },
        { name: 'features', type: 'JSONB', default: "'{}'" },
        { name: 'updated_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
      ];

      for (const col of columns) {
        try {
          await db.query(`
            ALTER TABLE license_config
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default}
          `);
        } catch (colError) {
          // Column might already exist, ignore the error
        }
      }

      // Add unique constraint on license_key if it doesn't exist
      try {
        await db.query(`
          ALTER TABLE license_config
          ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key)
        `);
      } catch (constraintError) {
        // Constraint might already exist, ignore
      }

      this.tableEnsured = true;
      // License table structure verified
    } catch (error) {
      console.error('❌ Error ensuring license table:', error);
      throw error;
    }
  }

  async removeLicense() {
    try {
      await db.query('DELETE FROM license_config');
      this.licenseData = null;
      // License removed from database
      return true;
    } catch (error) {
      console.error('❌ Error removing license:', error);
      return false;
    }
  }

  isLicenseValid() {
    if (!this.licenseData) return false;
    if (this.licenseData.status !== 'active') return false;

    // Check if license is expired
    if (this.licenseData.valid_until) {
      const validUntil = new Date(this.licenseData.valid_until);
      const now = new Date();
      if (now > validUntil) return false;
    }

    return true;
  }

  getLicenseInfo() {
    return this.licenseData;
  }
}

const licenseValidator = new LicenseValidator();

// Middleware to check license for protected routes
const requireValidLicense = async (req, res, next) => {
  try {
    // Allow developer role to bypass license check
    if (req.session?.user?.roles?.some(role => role.role_name === 'developer')) {
      return next();
    }

    // Allow access to login and license management routes
    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/admin/license') ||
      req.path === '/health'
    ) {
      return next();
    }

    const licenseStatus = await licenseValidator.checkLicense();

    if (!licenseValidator.isLicenseValid()) {
      // Always redirect to /admin/license if license is invalid
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({
          error: 'License invalid or expired',
          licenseStatus: licenseStatus,
          redirect: '/admin/license'
        });
      }

      req.flash('error', 'License invalid or expired. Please contact your administrator.');
      return res.redirect('/admin/license');
    }

    // Add license info to locals for views
    res.locals.licenseInfo = licenseStatus;
    next();
  } catch (error) {
    console.error('❌ License check error:', error);
    next(error);
  }
};

module.exports = {
  licenseValidator,
  requireValidLicense
};
