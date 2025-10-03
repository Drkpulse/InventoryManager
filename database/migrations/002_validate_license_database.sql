-- Migration: 002_validate_license_database.sql
-- Purpose: Validate and ensure license_config table has correct structure and data integrity
-- Created: 2025-01-XX

-- Ensure license_config table exists with all required fields
CREATE TABLE IF NOT EXISTS license_config (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(255) NOT NULL UNIQUE,
  company VARCHAR(255),
  valid_until TIMESTAMP,
  issued_to VARCHAR(255),
  features JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'error', 'missing')),
  last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validation_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Check if validation_attempts column exists, if not add it
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config'
                 AND column_name = 'validation_attempts') THEN
    ALTER TABLE license_config ADD COLUMN validation_attempts INTEGER DEFAULT 0;
  END IF;

  -- Check if unique constraint exists on license_key
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'license_config'
                 AND constraint_type = 'UNIQUE'
                 AND constraint_name LIKE '%license_key%') THEN
    ALTER TABLE license_config ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key);
  END IF;

  -- Check if status check constraint exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints
                 WHERE constraint_name LIKE '%license_config_status%') THEN
    ALTER TABLE license_config ADD CONSTRAINT license_config_status_check
      CHECK (status IN ('active', 'inactive', 'expired', 'error', 'missing'));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_license_config_status ON license_config(status);
CREATE INDEX IF NOT EXISTS idx_license_config_valid_until ON license_config(valid_until);
CREATE INDEX IF NOT EXISTS idx_license_config_last_checked ON license_config(last_checked);
CREATE INDEX IF NOT EXISTS idx_license_config_features ON license_config USING GIN (features);

-- Add update timestamp trigger
CREATE OR REPLACE FUNCTION update_license_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create new one
DROP TRIGGER IF EXISTS trigger_license_config_update_timestamp ON license_config;
CREATE TRIGGER trigger_license_config_update_timestamp
  BEFORE UPDATE ON license_config
  FOR EACH ROW
  EXECUTE FUNCTION update_license_config_timestamp();

-- Function to validate license data integrity
CREATE OR REPLACE FUNCTION validate_license_data()
RETURNS TABLE(
  validation_result TEXT,
  license_count INTEGER,
  active_licenses INTEGER,
  expired_licenses INTEGER,
  issues_found TEXT[]
) AS $$
DECLARE
  total_licenses INTEGER;
  active_count INTEGER;
  expired_count INTEGER;
  issues TEXT[] := '{}';
  rec RECORD;
BEGIN
  -- Count total licenses
  SELECT COUNT(*) INTO total_licenses FROM license_config;

  -- Count active licenses
  SELECT COUNT(*) INTO active_count
  FROM license_config
  WHERE status = 'active' AND (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP);

  -- Count expired licenses
  SELECT COUNT(*) INTO expired_count
  FROM license_config
  WHERE valid_until IS NOT NULL AND valid_until <= CURRENT_TIMESTAMP;

  -- Check for issues

  -- Multiple active licenses (should only have one)
  IF active_count > 1 THEN
    issues := array_append(issues, 'Multiple active licenses found - only one should be active');
  END IF;

  -- Licenses with future valid_until but inactive status
  FOR rec IN
    SELECT id, license_key, status, valid_until
    FROM license_config
    WHERE valid_until > CURRENT_TIMESTAMP AND status != 'active'
  LOOP
    issues := array_append(issues, format('License %s has future expiry but status is %s',
                                        substr(rec.license_key, 1, 10) || '...', rec.status));
  END LOOP;

  -- Licenses with past valid_until but active status
  FOR rec IN
    SELECT id, license_key, status, valid_until
    FROM license_config
    WHERE valid_until <= CURRENT_TIMESTAMP AND status = 'active'
  LOOP
    issues := array_append(issues, format('License %s is expired but marked as active',
                                        substr(rec.license_key, 1, 10) || '...'));
  END LOOP;

  -- Licenses without valid_until date
  FOR rec IN
    SELECT id, license_key, status
    FROM license_config
    WHERE valid_until IS NULL AND status = 'active'
  LOOP
    issues := array_append(issues, format('License %s has no expiry date',
                                        substr(rec.license_key, 1, 10) || '...'));
  END LOOP;

  -- Determine overall validation result
  IF array_length(issues, 1) IS NULL THEN
    validation_result := 'PASSED';
  ELSE
    validation_result := 'ISSUES_FOUND';
  END IF;

  RETURN QUERY SELECT validation_result, total_licenses, active_count, expired_count, issues;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired licenses
CREATE OR REPLACE FUNCTION cleanup_expired_licenses()
RETURNS TABLE(
  cleaned_count INTEGER,
  updated_licenses TEXT[]
) AS $$
DECLARE
  updated_count INTEGER := 0;
  updated_list TEXT[] := '{}';
  rec RECORD;
BEGIN
  -- Update expired licenses status
  FOR rec IN
    SELECT id, license_key, status
    FROM license_config
    WHERE valid_until <= CURRENT_TIMESTAMP AND status = 'active'
  LOOP
    UPDATE license_config
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE id = rec.id;

    updated_count := updated_count + 1;
    updated_list := array_append(updated_list, substr(rec.license_key, 1, 10) || '...');
  END LOOP;

  RETURN QUERY SELECT updated_count, updated_list;
END;
$$ LANGUAGE plpgsql;

-- Function to get license statistics
CREATE OR REPLACE FUNCTION get_license_statistics()
RETURNS TABLE(
  total_licenses INTEGER,
  active_licenses INTEGER,
  expired_licenses INTEGER,
  invalid_licenses INTEGER,
  current_license_company VARCHAR,
  current_license_valid_until TIMESTAMP,
  days_until_expiry INTEGER
) AS $$
DECLARE
  current_license RECORD;
BEGIN
  -- Get counts
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COUNT(*) FILTER (WHERE status = 'expired' OR (valid_until <= CURRENT_TIMESTAMP)) as expired,
    COUNT(*) FILTER (WHERE status IN ('error', 'inactive')) as invalid
  INTO total_licenses, active_licenses, expired_licenses, invalid_licenses
  FROM license_config;

  -- Get current active license info
  SELECT company, valid_until
  INTO current_license
  FROM license_config
  WHERE status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  current_license_company := current_license.company;
  current_license_valid_until := current_license.valid_until;

  -- Calculate days until expiry
  IF current_license.valid_until IS NOT NULL THEN
    days_until_expiry := EXTRACT(days FROM (current_license.valid_until - CURRENT_TIMESTAMP))::INTEGER;
  ELSE
    days_until_expiry := NULL;
  END IF;

  RETURN QUERY SELECT
    get_license_statistics.total_licenses,
    get_license_statistics.active_licenses,
    get_license_statistics.expired_licenses,
    get_license_statistics.invalid_licenses,
    get_license_statistics.current_license_company,
    get_license_statistics.current_license_valid_until,
    get_license_statistics.days_until_expiry;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments to the table
COMMENT ON TABLE license_config IS 'Stores license configuration and validation data for the application';
COMMENT ON COLUMN license_config.license_key IS 'The encrypted license key provided by the vendor';
COMMENT ON COLUMN license_config.company IS 'Company name the license is issued to';
COMMENT ON COLUMN license_config.valid_until IS 'License expiration date and time';
COMMENT ON COLUMN license_config.features IS 'JSON object containing enabled features for this license';
COMMENT ON COLUMN license_config.status IS 'Current license status: active, inactive, expired, error, missing';
COMMENT ON COLUMN license_config.last_checked IS 'Last time the license was validated with the server';
COMMENT ON COLUMN license_config.validation_attempts IS 'Number of validation attempts made';

-- Create a view for license dashboard information
CREATE OR REPLACE VIEW license_dashboard_view AS
SELECT
  l.*,
  CASE
    WHEN l.valid_until IS NULL THEN 'No expiry set'
    WHEN l.valid_until <= CURRENT_TIMESTAMP THEN 'Expired'
    WHEN l.valid_until <= CURRENT_TIMESTAMP + INTERVAL '30 days' THEN 'Expires soon'
    WHEN l.valid_until <= CURRENT_TIMESTAMP + INTERVAL '90 days' THEN 'Expires later'
    ELSE 'Valid'
  END AS expiry_status,
  CASE
    WHEN l.valid_until IS NULL THEN NULL
    ELSE EXTRACT(days FROM (l.valid_until - CURRENT_TIMESTAMP))::INTEGER
  END AS days_until_expiry,
  CASE
    WHEN l.last_checked < CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'Validation needed'
    WHEN l.last_checked < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'Recently validated'
    ELSE 'Current'
  END AS validation_status
FROM license_config l
ORDER BY l.created_at DESC;

-- Grant necessary permissions to application user (adjust username as needed)
-- Note: Replace 'app_user' with your actual application database user
DO $$
BEGIN
  -- Only grant if the role exists
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON license_config TO app_user;
    GRANT USAGE ON SEQUENCE license_config_id_seq TO app_user;
    GRANT EXECUTE ON FUNCTION validate_license_data() TO app_user;
    GRANT EXECUTE ON FUNCTION cleanup_expired_licenses() TO app_user;
    GRANT EXECUTE ON FUNCTION get_license_statistics() TO app_user;
    GRANT SELECT ON license_dashboard_view TO app_user;
  END IF;
END $$;

-- Insert validation result into migrations table
INSERT INTO schema_migrations (migration_name, executed_at, description)
VALUES (
  '002_validate_license_database',
  CURRENT_TIMESTAMP,
  'Validated license_config table structure and added integrity functions'
) ON CONFLICT (migration_name) DO UPDATE SET
  executed_at = CURRENT_TIMESTAMP,
  description = 'Validated license_config table structure and added integrity functions';
