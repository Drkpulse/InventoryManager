-- Purpose: Clean user lockout system - drop and recreate to fix function errors
-- Migration: 018_clean_user_lockout_system.sql
-- Date: 2025-10-10
-- Description: Drop existing lockout functions and recreate cleanly to avoid compatibility errors

BEGIN;

-- Drop existing user lockout functions to avoid conflicts
DROP FUNCTION IF EXISTS find_user_by_login(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_user_login_attempt(INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS reset_user_lockout(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_user_lockout_status(INTEGER) CASCADE;

-- Ensure users table has all required lockout columns
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Add failed_login_attempts column if missing
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Added failed_login_attempts column';
    END IF;

    -- Add account_locked column if missing
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'account_locked'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added account_locked column';
    END IF;

    -- Add locked_at column if missing
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_at'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN locked_at TIMESTAMP;
        RAISE NOTICE 'Added locked_at column';
    END IF;

    -- Add locked_until column if missing
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_until'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
        RAISE NOTICE 'Added locked_until column';
    END IF;

    -- Add login_attempts column if missing (legacy support)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'login_attempts'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Added login_attempts column';
    END IF;

    -- Add last_failed_login column if missing
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_failed_login'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE users ADD COLUMN last_failed_login TIMESTAMP;
        RAISE NOTICE 'Added last_failed_login column';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_cep_id_lower ON users(LOWER(cep_id));

-- Create clean user lookup function
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
    SELECT
        u.id,
        u.name,
        u.email,
        u.password,
        u.role,
        u.cep_id,
        u.active,
        u.settings,
        u.last_login,
        u.created_at,
        u.updated_at,
        COALESCE(u.login_attempts, 0) as login_attempts,
        COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
        COALESCE(u.account_locked, FALSE) as account_locked,
        u.locked_at,
        u.locked_until,
        u.last_failed_login
    FROM users u
    WHERE (LOWER(u.email) = LOWER(login_input) OR LOWER(u.cep_id) = LOWER(login_input))
    AND u.active = TRUE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update login attempt status
CREATE OR REPLACE FUNCTION update_user_login_attempt(user_id INTEGER, success BOOLEAN)
RETURNS VOID AS $$
DECLARE
    max_attempts INTEGER := 5;
    lockout_duration INTERVAL := '30 minutes';
BEGIN
    IF success THEN
        -- Reset failed attempts on successful login
        UPDATE users
        SET
            failed_login_attempts = 0,
            account_locked = FALSE,
            locked_at = NULL,
            locked_until = NULL,
            last_login = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = user_id;
    ELSE
        -- Increment failed attempts
        UPDATE users
        SET
            failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
            last_failed_login = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = user_id;

        -- Lock account if max attempts reached
        UPDATE users
        SET
            account_locked = TRUE,
            locked_at = CURRENT_TIMESTAMP,
            locked_until = CURRENT_TIMESTAMP + lockout_duration
        WHERE id = user_id
        AND COALESCE(failed_login_attempts, 0) >= max_attempts;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reset user lockout (admin function)
CREATE OR REPLACE FUNCTION reset_user_lockout(user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET
        failed_login_attempts = 0,
        account_locked = FALSE,
        locked_at = NULL,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is currently locked out
CREATE OR REPLACE FUNCTION check_user_lockout_status(user_id INTEGER)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_until TIMESTAMP,
    failed_attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN u.account_locked = TRUE AND (u.locked_until IS NULL OR u.locked_until > CURRENT_TIMESTAMP)
            THEN TRUE
            ELSE FALSE
        END as is_locked,
        u.locked_until,
        COALESCE(u.failed_login_attempts, 0) as failed_attempts
    FROM users u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-unlock expired lockouts function
CREATE OR REPLACE FUNCTION auto_unlock_expired_accounts()
RETURNS INTEGER AS $$
DECLARE
    unlocked_count INTEGER;
BEGIN
    UPDATE users
    SET
        account_locked = FALSE,
        locked_at = NULL,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE account_locked = TRUE
    AND locked_until IS NOT NULL
    AND locked_until <= CURRENT_TIMESTAMP;

    GET DIAGNOSTICS unlocked_count = ROW_COUNT;
    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for monitoring locked accounts
CREATE OR REPLACE VIEW locked_accounts_view AS
SELECT
    u.id,
    u.name,
    u.email,
    u.cep_id,
    u.failed_login_attempts,
    u.locked_at,
    u.locked_until,
    u.last_failed_login,
    CASE
        WHEN u.locked_until IS NULL OR u.locked_until <= CURRENT_TIMESTAMP
        THEN FALSE
        ELSE TRUE
    END as currently_locked,
    CASE
        WHEN u.locked_until > CURRENT_TIMESTAMP
        THEN u.locked_until - CURRENT_TIMESTAMP
        ELSE NULL
    END as time_remaining
FROM users u
WHERE u.account_locked = TRUE
OR u.failed_login_attempts > 0;

-- Add helpful comments
COMMENT ON FUNCTION find_user_by_login(TEXT) IS 'Safely lookup user by email or CEP ID with lockout info';
COMMENT ON FUNCTION update_user_login_attempt(INTEGER, BOOLEAN) IS 'Update user login attempt status and handle lockouts';
COMMENT ON FUNCTION reset_user_lockout(INTEGER) IS 'Admin function to manually reset user lockout';
COMMENT ON FUNCTION check_user_lockout_status(INTEGER) IS 'Check current lockout status for a user';
COMMENT ON FUNCTION auto_unlock_expired_accounts() IS 'Automatically unlock accounts with expired lockout periods';
COMMENT ON VIEW locked_accounts_view IS 'Monitor currently locked or problematic user accounts';

-- Final verification and cleanup
DO $$
DECLARE
    column_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Count required columns
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN ('failed_login_attempts', 'account_locked', 'locked_at', 'locked_until', 'login_attempts', 'last_failed_login')
    INTO column_count;

    -- Count created functions
    SELECT COUNT(*)
    FROM information_schema.routines
    WHERE routine_name IN ('find_user_by_login', 'update_user_login_attempt', 'reset_user_lockout', 'check_user_lockout_status', 'auto_unlock_expired_accounts')
    AND routine_schema = current_schema()
    INTO function_count;

    -- Clean up any expired lockouts
    PERFORM auto_unlock_expired_accounts();

    RAISE NOTICE '✅ User lockout system migration completed:';
    RAISE NOTICE '   - % out of 6 required columns exist', column_count;
    RAISE NOTICE '   - % out of 5 lockout functions created', function_count;
    RAISE NOTICE '   - Lockout monitoring view created';
    RAISE NOTICE '   - Expired lockouts cleaned up';
END $$;

COMMIT;
