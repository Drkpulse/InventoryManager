-- Validation script for database schema after migration fixes
-- Run this to check if all expected tables and columns exist

-- Check license_config table structure
SELECT
  'license_config table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'license_config'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check license_config required columns
SELECT
  'license_config.company column' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'company'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'license_config.features column' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'features'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'license_config.status column' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'license_config' AND column_name = 'status'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check users table login_attempts column
SELECT
  'users.login_attempts column' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'login_attempts'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check departments description column
SELECT
  'departments.description column' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'description'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check analytics tables
SELECT
  'user_analytics_events table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_analytics_events'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'page_performance_metrics table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'page_performance_metrics'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'user_session_summary table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_session_summary'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'cookie_consent_analytics table' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'cookie_consent_analytics'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check bypass license
SELECT
  'bypass license (iambeirao)' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM license_config
    WHERE license_key = 'iambeirao'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;
