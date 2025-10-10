-- Purpose: Column name standardization for user lockout fields
-- Migration: 015_standardize_user_lockout_columns.sql
-- Date: 2025-10-07
-- Description: Standardize column names to match schema and code expectations

-- Rename login_attempts to failed_login_attempts if needed for consistency
-- The schema shows login_attempts exists, but the code expects failed_login_attempts

DO $$
DECLARE
    has_login_attempts BOOLEAN := FALSE;
    has_failed_login_attempts BOOLEAN := FALSE;
BEGIN
    -- Check which columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'login_attempts'
    ) INTO has_login_attempts;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
    ) INTO has_failed_login_attempts;

    RAISE NOTICE '=== USER LOCKOUT COLUMN STANDARDIZATION ===';
    RAISE NOTICE 'login_attempts exists: %', has_login_attempts;
    RAISE NOTICE 'failed_login_attempts exists: %', has_failed_login_attempts;

    -- Strategy: Keep login_attempts as the source of truth since it exists in schema
    -- Add failed_login_attempts as an alias/computed column or use login_attempts directly

    IF has_login_attempts AND NOT has_failed_login_attempts THEN
        -- Add failed_login_attempts column and copy data from login_attempts
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;

        -- Copy existing data from login_attempts to failed_login_attempts
        UPDATE users SET failed_login_attempts = COALESCE(login_attempts, 0);

        RAISE NOTICE '✅ Added failed_login_attempts column and copied data from login_attempts';

    ELSIF NOT has_login_attempts AND has_failed_login_attempts THEN
        -- Add login_attempts column and copy data from failed_login_attempts
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;

        -- Copy existing data
        UPDATE users SET login_attempts = COALESCE(failed_login_attempts, 0);

        RAISE NOTICE '✅ Added login_attempts column and copied data from failed_login_attempts';

    ELSIF has_login_attempts AND has_failed_login_attempts THEN
        -- Both exist, sync them (use login_attempts as source of truth)
        UPDATE users SET failed_login_attempts = COALESCE(login_attempts, 0);

        RAISE NOTICE '✅ Synchronized failed_login_attempts with login_attempts';

    ELSE
        -- Neither exists, add both
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;

        RAISE NOTICE '✅ Added both login_attempts and failed_login_attempts columns';
    END IF;

    -- Ensure account_locked column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_locked'
    ) THEN
        ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added account_locked column';
    END IF;

    -- Ensure locked_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_at'
    ) THEN
        ALTER TABLE users ADD COLUMN locked_at TIMESTAMP;
        RAISE NOTICE '✅ Added locked_at column';
    END IF;

    RAISE NOTICE 'Column standardization completed successfully';
END $$;

-- Update find_user_by_login function to handle both column names gracefully
CREATE OR REPLACE FUNCTION find_user_by_login(login_input TEXT)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR,
  email VARCHAR,
  password VARCHAR,
  role VARCHAR,
  cep_id VARCHAR,
  active BOOLEAN,
  settings JSONB,
  last_login TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  login_attempts INTEGER,
  failed_login_attempts INTEGER,
  account_locked BOOLEAN,
  locked_at TIMESTAMP,
  locked_until TIMESTAMP,
  last_failed_login TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.active, u.settings, u.last_login, u.created_at, u.updated_at,
         COALESCE(u.login_attempts, 0) as login_attempts,
         COALESCE(u.failed_login_attempts, u.login_attempts, 0) as failed_login_attempts,
         COALESCE(u.account_locked, FALSE) as account_locked,
         u.locked_at,
         u.locked_until,
         u.last_failed_login
  FROM users u
  WHERE (LOWER(u.email) = LOWER(login_input) OR LOWER(u.cep_id) = LOWER(login_input))
  LIMIT 1;
EXCEPTION
  WHEN undefined_column THEN
    -- If columns don't exist, return basic user info with default values
    RETURN QUERY
    SELECT u.id, u.name, u.email, u.password, u.role, u.cep_id, u.active, u.settings, u.last_login, u.created_at, u.updated_at,
           0 as login_attempts,
           0 as failed_login_attempts,
           FALSE as account_locked,
           NULL::TIMESTAMP as locked_at,
           NULL::TIMESTAMP as locked_until,
           NULL::TIMESTAMP as last_failed_login
    FROM users u
    WHERE (LOWER(u.email) = LOWER(login_input) OR LOWER(u.cep_id) = LOWER(login_input))
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for the lockout columns
CREATE INDEX IF NOT EXISTS idx_users_lockout_standardized ON users(account_locked, locked_until);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts_standardized ON users(failed_login_attempts);
CREATE INDEX IF NOT EXISTS idx_users_login_attempts ON users(login_attempts);

-- Verify the column setup
DO $$
DECLARE
    column_count INTEGER;
    all_columns TEXT;
BEGIN
    SELECT COUNT(*), STRING_AGG(column_name, ', ' ORDER BY column_name)
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('login_attempts', 'failed_login_attempts', 'account_locked', 'locked_at', 'locked_until', 'last_failed_login')
    INTO column_count, all_columns;

    RAISE NOTICE '=== VERIFICATION COMPLETE ===';
    RAISE NOTICE 'User lockout columns (% found): %', column_count, all_columns;
END $$;
