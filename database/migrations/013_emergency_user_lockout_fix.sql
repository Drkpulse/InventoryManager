-- Purpose: Emergency fix for missing user lockout columns
-- Migration: 013_emergency_user_lockout_fix.sql
-- Date: 2025-10-07
-- Description: Ensures users table has all required lockout columns even if previous migrations failed

-- Add missing columns to users table with proper error handling
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check and add failed_login_attempts column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Added failed_login_attempts column to users table';
    ELSE
        RAISE NOTICE 'Column failed_login_attempts already exists in users table';
    END IF;

    -- Check and add account_locked column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_locked'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added account_locked column to users table';
    ELSE
        RAISE NOTICE 'Column account_locked already exists in users table';
    END IF;

    -- Check and add locked_at column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_at'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN locked_at TIMESTAMP;
        RAISE NOTICE 'Added locked_at column to users table';
    ELSE
        RAISE NOTICE 'Column locked_at already exists in users table';
    END IF;

    -- Check locked_until column (should already exist based on schema)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_until'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
        RAISE NOTICE 'Added locked_until column to users table';
    ELSE
        RAISE NOTICE 'Column locked_until already exists in users table';
    END IF;

    -- Check login_attempts column (should already exist based on schema)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'login_attempts'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Added login_attempts column to users table';
    ELSE
        RAISE NOTICE 'Column login_attempts already exists in users table';
    END IF;

    -- Check and add last_failed_login column (should already exist based on schema)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_failed_login'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP;
        RAISE NOTICE 'Added last_failed_login column to users table';
    ELSE
        RAISE NOTICE 'Column last_failed_login already exists in users table';
    END IF;

    RAISE NOTICE 'Emergency user lockout columns fix completed successfully';
END $$;

-- Create index for lockout columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts);

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS find_user_by_login(TEXT) CASCADE;

-- Create the find_user_by_login function to handle missing columns gracefully
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
         COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
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

-- Verify the columns were added successfully
DO $$
DECLARE
    column_count INTEGER;
    missing_columns TEXT[];
BEGIN
    -- Count how many of our required columns exist
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('failed_login_attempts', 'account_locked', 'locked_at', 'locked_until', 'login_attempts', 'last_failed_login')
    INTO column_count;

    -- Get list of missing columns
    SELECT ARRAY_AGG(col_name)
    FROM (
        SELECT unnest(ARRAY['failed_login_attempts', 'account_locked', 'locked_at', 'locked_until', 'login_attempts', 'last_failed_login']) AS col_name
    ) AS required_cols
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = required_cols.col_name
    )
    INTO missing_columns;

    IF column_count = 6 THEN
        RAISE NOTICE '✅ All 6 required lockout columns exist in users table';
    ELSE
        RAISE NOTICE '⚠️ Only % out of 6 lockout columns exist. Missing: %', column_count, missing_columns;
    END IF;
END $$;
