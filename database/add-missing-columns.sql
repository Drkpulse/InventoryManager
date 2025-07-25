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

-- Add contracts table for managing PDF/file attachments
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  entity_type VARCHAR(50) NOT NULL, -- 'pda', 'printer', 'sim_card', 'item', 'software', etc.
  entity_id INTEGER NOT NULL,
  contract_type VARCHAR(100), -- 'warranty', 'service', 'lease', 'purchase', etc.
  start_date DATE,
  end_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_entity ON contracts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);

-- Create contracts_history table for audit trail
CREATE TABLE IF NOT EXISTS contracts_history (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'downloaded'
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_history_contract ON contracts_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_history_action ON contracts_history(action_type);

-- Verify the changes by checking column existence
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'software', 'employee_software', 'items') 
    AND column_name IN ('active', 'settings', 'description', 'max_licenses', 'license_key')
ORDER BY table_name, column_name;