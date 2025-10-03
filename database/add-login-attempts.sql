-- Add login attempts tracking columns to users table
-- This migration adds support for failed login attempts and account locking

-- Add columns for login attempt tracking
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Create index for performance on locked accounts
CREATE INDEX IF NOT EXISTS idx_users_account_locked ON users(account_locked) WHERE account_locked = true;
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;

-- Add function to handle failed login attempts
CREATE OR REPLACE FUNCTION handle_failed_login_attempt(user_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
    current_attempts INTEGER;
    max_attempts INTEGER := 5; -- Maximum failed attempts before locking
    lockout_duration INTERVAL := '30 minutes'; -- How long to lock the account
BEGIN
    -- Get current failed attempts
    SELECT failed_login_attempts INTO current_attempts
    FROM users WHERE id = user_id_param;

    -- Increment failed attempts
    current_attempts := COALESCE(current_attempts, 0) + 1;

    -- Update failed attempts
    IF current_attempts >= max_attempts THEN
        -- Lock the account
        UPDATE users
        SET failed_login_attempts = current_attempts,
            account_locked = true,
            locked_at = NOW(),
            locked_until = NOW() + lockout_duration
        WHERE id = user_id_param;
    ELSE
        -- Just increment attempts
        UPDATE users
        SET failed_login_attempts = current_attempts
        WHERE id = user_id_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add function to handle successful login (reset attempts)
CREATE OR REPLACE FUNCTION handle_successful_login(user_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Reset failed attempts and unlock account on successful login
    UPDATE users
    SET failed_login_attempts = 0,
        account_locked = false,
        locked_at = NULL,
        locked_until = NULL,
        last_login = NOW()
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Add function to unlock a user account manually
CREATE OR REPLACE FUNCTION unlock_user_account(user_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET failed_login_attempts = 0,
        account_locked = false,
        locked_at = NULL,
        locked_until = NULL
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Add function to check if account is currently locked
CREATE OR REPLACE FUNCTION is_account_locked(user_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    locked BOOLEAN := false;
    locked_until_time TIMESTAMP;
BEGIN
    SELECT account_locked, locked_until INTO locked, locked_until_time
    FROM users WHERE id = user_id_param;

    -- If not locked, return false
    IF NOT COALESCE(locked, false) THEN
        RETURN false;
    END IF;

    -- If locked but lockout period has expired, unlock automatically
    IF locked_until_time IS NOT NULL AND NOW() > locked_until_time THEN
        PERFORM unlock_user_account(user_id_param);
        RETURN false;
    END IF;

    -- Account is still locked
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_failed_login_attempt(INTEGER) IS 'Increments failed login attempts and locks account if threshold exceeded';
COMMENT ON FUNCTION handle_successful_login(INTEGER) IS 'Resets failed login attempts on successful login';
COMMENT ON FUNCTION unlock_user_account(INTEGER) IS 'Manually unlocks a user account';
COMMENT ON FUNCTION is_account_locked(INTEGER) IS 'Checks if an account is currently locked';

-- Update any existing users to have default values
UPDATE users
SET failed_login_attempts = 0,
    account_locked = false
WHERE failed_login_attempts IS NULL OR account_locked IS NULL;
