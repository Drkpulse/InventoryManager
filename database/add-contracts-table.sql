-- Add contracts table for managing PDF/file attachments

-- Create contracts table
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

-- Create indexes for performance
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