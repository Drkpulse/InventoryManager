-- Migration to add user settings support
-- Add settings column to users table to store JSON preferences

ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add index for better performance on settings queries
CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING GIN (settings);

-- Update existing users with default settings
UPDATE users
SET settings = '{
  "language": "en",
  "theme": "light",
  "timezone": "UTC",
  "items_per_page": "20",
  "email_notifications": true,
  "browser_notifications": true,
  "maintenance_alerts": true,
  "assignment_notifications": true,
  "session_timeout": false,
  "two_factor_auth": false
}'::jsonb
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- Add constraint to ensure settings is always valid JSON
ALTER TABLE users ADD CONSTRAINT check_settings_valid_json
CHECK (settings IS NULL OR jsonb_typeof(settings) = 'object');
