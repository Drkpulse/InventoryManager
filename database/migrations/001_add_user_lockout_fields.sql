-- Migration: Add account lockout fields to users table
-- Date: 2025-09-25
-- Description: Adds failed login tracking and account lockout functionality

-- Add account lockout fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Create index for faster lookups on locked accounts
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);

-- Add comment for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked IS 'Whether the account is currently locked due to failed attempts';
COMMENT ON COLUMN users.locked_at IS 'Timestamp when the account was locked';
COMMENT ON COLUMN users.locked_until IS 'Timestamp when the account lock expires';
