-- Migration: 010_fix_license_config_columns.sql
-- Purpose: Fix license_config table column inconsistencies (if they exist)
-- Issue: Table may have both 'company' and 'company_name' columns, causing INSERT conflicts

-- Check if company_name column exists and handle it safely
DO $$
DECLARE
  has_company_name BOOLEAN;
  has_company BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'company_name'
  ) INTO has_company_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'company'
  ) INTO has_company;

  -- Only handle column migration if company_name exists
  IF has_company_name THEN
    RAISE NOTICE 'Found company_name column, migrating data...';

    -- Copy data from company_name to company if company is null
    IF has_company THEN
      UPDATE license_config
      SET company = company_name
      WHERE company IS NULL AND company_name IS NOT NULL;
      RAISE NOTICE 'Copied data from company_name to company';
    ELSE
      -- If company column doesn't exist, rename company_name to company
      ALTER TABLE license_config RENAME COLUMN company_name TO company;
      RAISE NOTICE 'Renamed company_name column to company';
    END IF;

    -- Drop the company_name column if it still exists (after data copy)
    IF has_company THEN
      ALTER TABLE license_config DROP COLUMN company_name;
      RAISE NOTICE 'Dropped company_name column';
    END IF;
  ELSE
    RAISE NOTICE 'No company_name column found, structure is already correct';
  END IF;
END $$;

-- Drop dependent views that might reference old column names
DROP VIEW IF EXISTS license_dashboard_view;

-- Ensure all required columns exist with correct names
-- The application expects these exact columns:
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS company VARCHAR(255);
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS issued_to VARCHAR(255);
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS validation_attempts INTEGER DEFAULT 0;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE license_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Drop any old columns that might exist with different names
ALTER TABLE license_config DROP COLUMN IF EXISTS last_validated;

-- Ensure the bypass license exists with correct data
INSERT INTO license_config (license_key, company, valid_until, status, features, last_checked)
VALUES (
  'iambeirao',
  'Test Company',
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  'active',
  '{"bypass": true, "testing": true}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT (license_key) DO UPDATE SET
  company = EXCLUDED.company,
  valid_until = EXCLUDED.valid_until,
  status = EXCLUDED.status,
  features = EXCLUDED.features,
  last_checked = EXCLUDED.last_checked,
  updated_at = CURRENT_TIMESTAMP;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'license_config'
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'license_config_license_key_unique'
  ) THEN
    ALTER TABLE license_config ADD CONSTRAINT license_config_license_key_unique UNIQUE (license_key);
  END IF;
END $$;

-- Recreate the license_dashboard_view without company_name reference
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

-- Verify the table structure is correct
DO $$
DECLARE
  company_col_count INTEGER;
  company_name_col_count INTEGER;
BEGIN
  -- Check for company column
  SELECT COUNT(*) INTO company_col_count
  FROM information_schema.columns
  WHERE table_name = 'license_config' AND column_name = 'company';

  -- Check for company_name column (should not exist after migration)
  SELECT COUNT(*) INTO company_name_col_count
  FROM information_schema.columns
  WHERE table_name = 'license_config' AND column_name = 'company_name';

  -- Report current state
  RAISE NOTICE 'Migration verification: company column count = %, company_name column count = %',
    company_col_count, company_name_col_count;

  IF company_col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: company column is missing - this is required';
  END IF;

  IF company_name_col_count > 0 THEN
    RAISE NOTICE 'Warning: company_name column still exists after migration';
  END IF;

  -- Log success
  RAISE NOTICE 'License config table structure verified: company column exists (count: %), view recreated', company_col_count;
END $$;

-- Record the migration
INSERT INTO schema_migrations (migration_name, executed_at, description)
VALUES (
  '010_fix_license_config_columns',
  CURRENT_TIMESTAMP,
  'Fixed license_config table column inconsistencies - removed duplicate company_name column'
)
ON CONFLICT (migration_name) DO UPDATE SET
  executed_at = CURRENT_TIMESTAMP,
  description = 'Fixed license_config table column inconsistencies - removed duplicate company_name column';
