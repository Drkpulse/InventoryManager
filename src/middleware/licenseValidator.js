const axios = require('axios');
const db = require('../config/db');

class LicenseValidator {
  constructor() {
    this.licenseData = null;
    this.lastCheck = null;
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.validationUrl = process.env.LICENSE_VALIDATION_URL || 'https://license.voidbyte.xyz/api/validate';
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
      console.log('🔍 Validating license key...');

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

      console.log('✅ License validation successful:', licenseData.status);
      return licenseData;

    } catch (error) {
      console.error('❌ License validation error:', error.message);

      // Increment validation attempts
      await this.incrementValidationAttempts(licenseKey);

      // If network error and we have recent valid license from DB, allow it
      const dbLicense = await this.getLicenseFromDB(licenseKey);
      if (dbLicense && dbLicense.status === 'active' &&
          new Date(dbLicense.last_validated) > new Date(Date.now() - this.checkInterval)) {

        console.log('📱 Using cached valid license from database');
        this.licenseData = {
          status: dbLicense.status,
          company: dbLicense.company_name,
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

      // Check if we need to revalidate
      const needsRevalidation = !currentLicense.last_validated ||
        (new Date() - new Date(currentLicense.last_validated)) > this.checkInterval;

      if (needsRevalidation) {
        console.log('🔄 License needs revalidation');
        return await this.validateLicense(currentLicense.license_key);
      }

      // Use cached data from database
      this.licenseData = {
        status: currentLicense.status,
        company: currentLicense.company_name,
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
      const result = await db.query(`
        SELECT * FROM license_config
        WHERE license_key = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [licenseKey]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting license from DB:', error);
      return null;
    }
  }

  async storeLicenseInDB(licenseKey, licenseData) {
    try {
      const validUntil = licenseData.valid_until ? new Date(licenseData.valid_until) : null;

      // Check if license already exists
      const existing = await this.getLicenseFromDB(licenseKey);

      if (existing) {
        // Update existing license
        await db.query(`
          UPDATE license_config
          SET company_name = $1,
              valid_until = $2,
              status = $3,
              last_validated = CURRENT_TIMESTAMP,
              validation_attempts = 0
          WHERE license_key = $4
        `, [licenseData.company, validUntil, licenseData.status, licenseKey]);

        console.log('📝 Updated existing license in database');
      } else {
        // Insert new license
        await db.query(`
          INSERT INTO license_config (license_key, company_name, valid_until, status, validation_attempts)
          VALUES ($1, $2, $3, $4, 0)
        `, [licenseKey, licenseData.company, validUntil, licenseData.status]);

        console.log('📝 Stored new license in database');
      }
    } catch (error) {
      console.error('❌ Error storing license in DB:', error);
    }
  }

  async incrementValidationAttempts(licenseKey) {
    try {
      await db.query(`
        UPDATE license_config
        SET validation_attempts = validation_attempts + 1
        WHERE license_key = $1
      `, [licenseKey]);
    } catch (error) {
      console.error('❌ Error incrementing validation attempts:', error);
    }
  }

  async removeLicense() {
    try {
      await db.query('DELETE FROM license_config');
      this.licenseData = null;
      console.log('🗑️ License removed from database');
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
