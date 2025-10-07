-- Quick check of license_config table structure
-- Run this to see the current state before running migration 010

SELECT
  'Current license_config columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'license_config'
ORDER BY ordinal_position;

-- Check if company_name column exists
SELECT
  'company_name column check' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'company_name'
  ) THEN 'EXISTS' ELSE 'DOES NOT EXIST' END as result;

-- Check if company column exists
SELECT
  'company column check' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'company'
  ) THEN 'EXISTS' ELSE 'DOES NOT EXIST' END as result;

-- Show any existing data in license_config
SELECT
  'Current license_config data:' as info,
  license_key,
  CASE WHEN LENGTH(license_key) > 20 THEN LEFT(license_key, 20) || '...' ELSE license_key END as display_key,
  status,
  created_at
FROM license_config
ORDER BY created_at DESC
LIMIT 5;
