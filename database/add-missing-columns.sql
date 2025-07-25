-- Add missing columns to fix database errors

-- Add 'active' column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Add 'settings' column to users table for user preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add 'description' and 'max_licenses' columns to software table
ALTER TABLE software ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE software ADD COLUMN IF NOT EXISTS max_licenses INTEGER DEFAULT 1;

-- Add 'description' column to items table (referenced in item controller)
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;

-- Add 'license_key' column to employee_software table (referenced in schema)
ALTER TABLE employee_software ADD COLUMN IF NOT EXISTS license_key VARCHAR(255);

-- Update existing users to be active by default
UPDATE users SET active = TRUE WHERE active IS NULL;

-- Update existing software to have default max_licenses
UPDATE software SET max_licenses = 1 WHERE max_licenses IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_software_max_licenses ON software(max_licenses);

-- Verify the changes by checking column existence
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'software', 'employee_software', 'items') 
    AND column_name IN ('active', 'settings', 'description', 'max_licenses', 'license_key')
ORDER BY table_name, column_name;