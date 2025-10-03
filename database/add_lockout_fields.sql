-- Add account lockout fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Create index for faster lookups on locked accounts
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(account_locked, locked_until);
