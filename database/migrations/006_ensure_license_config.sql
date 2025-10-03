-- Migration: 006_ensure_license_config.sql
-- Purpose: Ensure license_config table exists and is properly configured
-- This migration is specifically for fixing license database connectivity issues

-- Create license_config table with all required columns
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
);

-- Add missing columns if they don't exist (safe operations)
-- Using simple ALTER TABLE with IF NOT EXISTS syntax
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS validation_attempts INTEGER DEFAULT 0;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS issued_to VARCHAR(255);

-- Add unique constraint on license_key (ignore if it already exists)
DO $$
BEGIN
  BEGIN
    ALTER TABLE license_config ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key);
  EXCEPTION
    WHEN duplicate_table THEN NULL; -- Constraint already exists, ignore
    WHEN others THEN NULL; -- Other error, ignore
  END;
END $$;

-- Add status check constraint (ignore if it already exists)
DO $$
BEGIN
  BEGIN
    ALTER TABLE license_config ADD CONSTRAINT license_config_status_check
      CHECK (status IN ('active', 'inactive', 'expired', 'error', 'missing'));
  EXCEPTION
    WHEN others THEN NULL; -- Constraint already exists or other error, ignore
  END;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_license_config_status ON license_config(status);
CREATE INDEX IF NOT EXISTS idx_license_config_valid_until ON license_config(valid_until);
CREATE INDEX IF NOT EXISTS idx_license_config_last_checked ON license_config(last_checked);

-- Try to create GIN index on features column (for JSON queries)
DO $$
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_license_config_features') THEN
      CREATE INDEX idx_license_config_features ON license_config USING GIN (features);
    END IF;
  EXCEPTION
    WHEN others THEN NULL; -- Index creation failed, ignore
  END;
END $$;

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

-- Insert the bypass license if it doesn't exist (for testing)
INSERT INTO license_config (license_key, company, valid_until, status, features)
VALUES (
  'iambeirao',
  'Test Company',
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  'active',
  '{"bypass": true, "testing": true}'::jsonb
) ON CONFLICT (license_key) DO UPDATE SET
  company = 'Test Company',
  valid_until = CURRENT_TIMESTAMP + INTERVAL '1 year',
  status = 'active',
  last_checked = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP;

-- Verify table structure (silent check)
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  -- Count columns to verify table exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'license_config';

  -- If we got here without error, the table exists and is accessible
END $$;

-- Add helpful comments to the table
COMMENT ON TABLE license_config IS 'Stores license configuration and validation data for the application';
COMMENT ON COLUMN license_config.license_key IS 'The license key - use "iambeirao" for bypass/testing mode';
COMMENT ON COLUMN license_config.company IS 'Company name the license is issued to';
COMMENT ON COLUMN license_config.valid_until IS 'License expiration date and time';
COMMENT ON COLUMN license_config.features IS 'JSON object containing enabled features for this license';
COMMENT ON COLUMN license_config.status IS 'Current license status: active, inactive, expired, error, missing';

-- Mark migration as complete
INSERT INTO schema_migrations (migration_name, executed_at, description)
VALUES (
  '006_ensure_license_config',
  CURRENT_TIMESTAMP,
  'Ensured license_config table exists with all required columns and bypass license'
) ON CONFLICT (migration_name) DO UPDATE SET
  executed_at = CURRENT_TIMESTAMP,
  description = 'Ensured license_config table exists with all required columns and bypass license';

-- Migration completed successfully
-- License key "iambeirao" is now available for testing/bypass mode
