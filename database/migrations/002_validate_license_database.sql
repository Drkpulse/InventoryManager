-- Migration: 002_validate_license_database.sql
-- Purpose: Ensure license_config table has correct structure
-- Created: 2025-01-XX

-- Ensure license_config table exists with all required fields
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
DO $$
BEGIN
  -- Add each column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'company') THEN
    ALTER TABLE license_config ADD COLUMN company VARCHAR(255);
    RAISE NOTICE 'Added company column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'valid_until') THEN
    ALTER TABLE license_config ADD COLUMN valid_until TIMESTAMP;
    RAISE NOTICE 'Added valid_until column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'issued_to') THEN
    ALTER TABLE license_config ADD COLUMN issued_to VARCHAR(255);
    RAISE NOTICE 'Added issued_to column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'features') THEN
    ALTER TABLE license_config ADD COLUMN features JSONB DEFAULT '{}';
    RAISE NOTICE 'Added features column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'status') THEN
    ALTER TABLE license_config ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    RAISE NOTICE 'Added status column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'last_checked') THEN
    ALTER TABLE license_config ADD COLUMN last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    RAISE NOTICE 'Added last_checked column to license_config';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'license_config' AND column_name = 'validation_attempts') THEN
    ALTER TABLE license_config ADD COLUMN validation_attempts INTEGER DEFAULT 0;
    RAISE NOTICE 'Added validation_attempts column to license_config';
  END IF;

  -- Add unique constraint on license_key if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'license_config' AND constraint_type = 'UNIQUE'
                 AND constraint_name LIKE '%license_key%') THEN
    BEGIN
      ALTER TABLE license_config ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key);
      RAISE NOTICE 'Added unique constraint on license_key';
    EXCEPTION
      WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint on license_key already exists';
    END;
  END IF;

  -- Add status check constraint if it doesn't exist
  BEGIN
    ALTER TABLE license_config ADD CONSTRAINT license_config_status_check
      CHECK (status IN ('active', 'inactive', 'expired', 'error', 'missing'));
    RAISE NOTICE 'Added status check constraint';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Status check constraint already exists';
  END;

  RAISE NOTICE 'License config table structure validation completed';
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_license_config_status ON license_config(status);
CREATE INDEX IF NOT EXISTS idx_license_config_valid_until ON license_config(valid_until);
CREATE INDEX IF NOT EXISTS idx_license_config_last_checked ON license_config(last_checked);

-- Try to create GIN index on features (may fail if JSONB not supported)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_license_config_features') THEN
    CREATE INDEX idx_license_config_features ON license_config USING GIN (features);
    RAISE NOTICE 'Created GIN index on features column';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create GIN index on features: %', SQLERRM;
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

-- Add table comments for documentation
COMMENT ON TABLE license_config IS 'Stores license configuration and validation data for the application';
COMMENT ON COLUMN license_config.license_key IS 'The license key - use "iambeirao" for bypass/testing mode';
COMMENT ON COLUMN license_config.company IS 'Company name the license is issued to';
COMMENT ON COLUMN license_config.valid_until IS 'License expiration date and time';
COMMENT ON COLUMN license_config.features IS 'JSON object containing enabled features for this license';
COMMENT ON COLUMN license_config.status IS 'Current license status: active, inactive, expired, error, missing';
COMMENT ON COLUMN license_config.last_checked IS 'Last time the license was validated with the server';
COMMENT ON COLUMN license_config.validation_attempts IS 'Number of validation attempts made';

-- Insert validation result into migrations table
INSERT INTO schema_migrations (migration_name, executed_at, description)
VALUES (
  '002_validate_license_database',
  CURRENT_TIMESTAMP,
  'Ensured license_config table has correct structure with all required columns'
) ON CONFLICT (migration_name) DO UPDATE SET
  executed_at = CURRENT_TIMESTAMP,
  description = 'Ensured license_config table has correct structure with all required columns';
