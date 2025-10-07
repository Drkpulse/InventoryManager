-- Migration: 010_fix_license_config_columns.sql
-- Purpose: Fix license_config table column inconsistencies
-- Issue: Table has both 'company' and 'company_name' columns, causing INSERT conflicts

-- First, ensure we have the data in the correct column
-- Copy data from company_name to company if company is null
UPDATE license_config 
SET company = company_name 
WHERE company IS NULL AND company_name IS NOT NULL;

-- Copy data from company to company_name if company_name is null
UPDATE license_config 
SET company_name = company 
WHERE company_name IS NULL AND company IS NOT NULL;

-- Drop dependent objects that reference company_name column
-- Drop the license_dashboard_view since it references company_name
DROP VIEW IF EXISTS license_dashboard_view;

-- Drop the duplicate company_name column since our application uses 'company'
ALTER TABLE license_config DROP COLUMN IF EXISTS company_name;

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
  
  -- Check for company_name column (should not exist)
  SELECT COUNT(*) INTO company_name_col_count
  FROM information_schema.columns
  WHERE table_name = 'license_config' AND column_name = 'company_name';
  
  IF company_col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: company column missing';
  END IF;
  
  IF company_name_col_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: company_name column still exists';
  END IF;
  
  -- Log success
  RAISE NOTICE 'License config table structure verified: company column exists, company_name removed, view recreated';
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
