-- Purpose: Verify and ensure all security-related user lockout columns exist
-- Migration: 012_verify_security_schema.sql
-- Date: 2025-10-07
-- Description: Simple migration to add missing user lockout columns

-- ===== VERIFY USER TABLE COLUMNS =====

-- Ensure users table has all required lockout fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Add indexes for users table lockout fields
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts);

-- ===== COMMENTS =====

COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked IS 'Whether the account is currently locked due to failed attempts';
COMMENT ON COLUMN users.locked_at IS 'Timestamp when the account was locked';
COMMENT ON COLUMN users.locked_until IS 'Timestamp when the account lock expires';

-- ===== VERIFICATION QUERIES =====

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'User lockout columns verification completed successfully';
  RAISE NOTICE 'Users table updated with lockout columns and indexes';
END $$;
