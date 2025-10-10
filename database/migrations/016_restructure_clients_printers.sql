-- Migration 016: Restructure clients and printers tables
-- This migration updates existing databases to the new structure

BEGIN;

-- First, backup existing data if tables exist
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Check if clients table exists with old structure
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'clients' AND column_name = 'client_id'
    ) INTO table_exists;

    IF table_exists THEN
        -- Create temporary backup of clients data
        CREATE TEMP TABLE clients_backup AS SELECT * FROM clients;
        RAISE NOTICE 'Backed up existing clients data';
    END IF;

    -- Check if printers table exists with employee_id
    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'printers' AND column_name = 'employee_id'
    ) INTO table_exists;

    IF table_exists THEN
        -- Create temporary backup of printers data
        CREATE TEMP TABLE printers_backup AS SELECT * FROM printers;
        RAISE NOTICE 'Backed up existing printers data';
    END IF;
END $$;

-- Drop dependent tables first (in correct order)
DROP TABLE IF EXISTS client_history CASCADE;
DROP TABLE IF EXISTS printer_history CASCADE;
DROP TABLE IF EXISTS pda_history CASCADE;
DROP TABLE IF EXISTS sim_card_history CASCADE;
DROP TABLE IF EXISTS sim_cards CASCADE;
DROP TABLE IF EXISTS pdas CASCADE;
DROP TABLE IF EXISTS printers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Recreate clients table with new structure
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  pnumber VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate printers table with new structure (no employee_id)
CREATE TABLE printers (
  id SERIAL PRIMARY KEY,
  supplier VARCHAR(255),
  model VARCHAR(255),
  client_id INTEGER REFERENCES clients(id),
  cost DECIMAL(10, 2),
  status_id INTEGER REFERENCES statuses(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate pdas table
CREATE TABLE pdas (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(255) UNIQUE NOT NULL,
  model VARCHAR(255),
  client_id INTEGER REFERENCES clients(id),
  cost DECIMAL(10, 2),
  status_id INTEGER REFERENCES statuses(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate sim_cards table
CREATE TABLE sim_cards (
  id SERIAL PRIMARY KEY,
  sim_number VARCHAR(255) UNIQUE NOT NULL,
  carrier VARCHAR(255),
  client_id INTEGER REFERENCES clients(id),
  pda_id INTEGER REFERENCES pdas(id),
  monthly_cost DECIMAL(10, 2),
  status_id INTEGER REFERENCES statuses(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate history tables
CREATE TABLE client_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE printer_history (
  id SERIAL PRIMARY KEY,
  printer_id INTEGER REFERENCES printers(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pda_history (
  id SERIAL PRIMARY KEY,
  pda_id INTEGER REFERENCES pdas(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sim_card_history (
  id SERIAL PRIMARY KEY,
  sim_card_id INTEGER REFERENCES sim_cards(id),
  action_type VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_printers_client ON printers(client_id);
CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status_id);
CREATE INDEX IF NOT EXISTS idx_pdas_client ON pdas(client_id);
CREATE INDEX IF NOT EXISTS idx_pdas_status ON pdas(status_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_client ON sim_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_pda ON sim_cards(pda_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status_id);
CREATE INDEX IF NOT EXISTS idx_client_history_client ON client_history(client_id);
CREATE INDEX IF NOT EXISTS idx_printer_history_printer ON printer_history(printer_id);
CREATE INDEX IF NOT EXISTS idx_pda_history_pda ON pda_history(pda_id);
CREATE INDEX IF NOT EXISTS idx_sim_card_history_sim_card ON sim_card_history(sim_card_id);

-- Restore data from backups if they existed
DO $$
DECLARE
    table_exists BOOLEAN;
    rec RECORD;
BEGIN
    -- Restore clients data if backup exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'clients_backup' AND table_schema = 'pg_temp_1'
    ) INTO table_exists;

    IF table_exists THEN
        -- Migrate clients data (client_id -> pnumber)
        FOR rec IN SELECT * FROM clients_backup LOOP
            INSERT INTO clients (pnumber, name, description, created_at, updated_at)
            VALUES (rec.client_id, rec.name, rec.description, rec.created_at, rec.updated_at);
        END LOOP;
        RAISE NOTICE 'Restored clients data with new structure';
    ELSE
        -- Insert sample clients if no backup exists
        INSERT INTO clients (pnumber, name, description) VALUES
          ('CLI001', 'TechCorp Solutions', 'Main technology partner'),
          ('CLI002', 'Digital Services Ltd', 'Digital transformation services'),
          ('CLI003', 'Innovation Hub', 'Innovation and development center'),
          ('CLI004', 'PrintCorp Ltd', 'Printing and publishing services'),
          ('CLI005', 'DataLogistics Inc', 'Data collection and logistics'),
          ('CLI006', 'Mobile Solutions SA', 'Mobile device management');
        RAISE NOTICE 'Inserted sample clients data';
    END IF;

    -- Restore printers data if backup exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'printers_backup' AND table_schema = 'pg_temp_1'
    ) INTO table_exists;

    IF table_exists THEN
        -- Migrate printers data (remove employee_id, keep client_id)
        FOR rec IN SELECT * FROM printers_backup LOOP
            INSERT INTO printers (supplier, model, client_id, cost, status_id, created_at, updated_at)
            VALUES (rec.supplier, rec.model, rec.client_id, rec.cost, rec.status_id, rec.created_at, rec.updated_at);
        END LOOP;
        RAISE NOTICE 'Restored printers data with new structure (removed employee assignments)';
    ELSE
        -- Insert sample printers if no backup exists
        INSERT INTO printers (supplier, model, client_id, cost, status_id) VALUES
          ('HP Inc.', 'LaserJet Pro 4000', 4, 299.99, 1),
          ('Canon', 'PIXMA MG3620', 4, 79.99, 1),
          ('Epson', 'EcoTank ET-2720', 5, 199.99, 1),
          ('Brother', 'HL-L2350DW', 6, 149.99, 2);
        RAISE NOTICE 'Inserted sample printers data';
    END IF;
END $$;

-- Insert sample PDAs and SIM cards if they don't exist
INSERT INTO pdas (serial_number, model, client_id, cost, status_id) VALUES
  ('PDA001', 'Zebra TC21', 1, 450.00, 1),
  ('PDA002', 'Honeywell CT30', 1, 380.00, 1),
  ('PDA003', 'Zebra TC26', 2, 520.00, 1),
  ('PDA004', 'Datalogic Memor 10', 3, 395.00, 2),
  ('PDA005', 'Zebra TC21', 2, 450.00, 1)
ON CONFLICT (serial_number) DO NOTHING;

INSERT INTO sim_cards (sim_number, carrier, client_id, pda_id, monthly_cost, status_id) VALUES
  ('SIM001234567', 'Vodafone', 1, 1, 25.00, 1),
  ('SIM001234568', 'MEO', 1, NULL, 20.00, 1),
  ('SIM001234569', 'NOS', 2, 3, 30.00, 1),
  ('SIM001234570', 'Vodafone', 2, NULL, 25.00, 2),
  ('SIM001234571', 'MEO', 3, NULL, 20.00, 1),
  ('SIM001234572', 'Vodafone', 4, NULL, 25.00, 1),
  ('SIM001234573', 'NOS', 5, NULL, 30.00, 1),
  ('SIM001234574', 'MEO', 6, NULL, 20.00, 1)
ON CONFLICT (sim_number) DO NOTHING;

-- Log the migration
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
VALUES (1, 'migration', 'database', 16, '{"migration": "016_restructure_clients_printers", "description": "Restructured clients and printers tables"}', '127.0.0.1');

COMMIT;

-- Display migration completion message
DO $$
BEGIN
    RAISE NOTICE 'Migration 016 completed successfully!';
    RAISE NOTICE 'Clients table now uses pnumber instead of client_id';
    RAISE NOTICE 'Printers table no longer has employee_id (only assigned to clients)';
    RAISE NOTICE 'All history tables have been recreated';
END $$;
