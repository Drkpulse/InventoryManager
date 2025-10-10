-- Purpose: Complete restructure of clients and printers tables with clean drop/create
-- Migration: 017_clean_restructure_clients_printers.sql
-- Date: 2025-10-10
-- Description: Drop existing tables and create new structure to avoid compatibility issues

BEGIN;

-- Store current data before dropping tables (if they exist)
DO $$
BEGIN
    -- Drop any existing backup tables first
    DROP TABLE IF EXISTS clients_backup;
    DROP TABLE IF EXISTS printers_backup;

    -- Create temporary backup tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        CREATE TEMP TABLE clients_backup AS SELECT * FROM clients;
        RAISE NOTICE 'Created backup of existing clients table';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'printers') THEN
        CREATE TEMP TABLE printers_backup AS SELECT * FROM printers;
        RAISE NOTICE 'Created backup of existing printers table';
    END IF;
END $$;

-- Drop existing tables and their dependencies
DROP TABLE IF EXISTS printers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Create new clients table with pnumber as unique identifier
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pnumber VARCHAR(255) UNIQUE NOT NULL,  -- Changed from client_id to pnumber
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create new printers table (only assigned to clients, not employees)
CREATE TABLE printers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    ip_address INET,
    location VARCHAR(255),
    description TEXT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,  -- Only client assignment
    status_id INTEGER REFERENCES statuses(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- Create indexes for performance
CREATE INDEX idx_clients_pnumber ON clients(pnumber);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_printers_client_id ON printers(client_id);
CREATE INDEX idx_printers_ip_address ON printers(ip_address);
CREATE INDEX idx_printers_serial_number ON printers(serial_number);
CREATE INDEX idx_printers_status_id ON printers(status_id);
CREATE INDEX idx_printers_name ON printers(name);

-- Add comments for documentation
COMMENT ON TABLE clients IS 'Client organizations that own assets';
COMMENT ON COLUMN clients.pnumber IS 'Unique client identifier (replaces client_id)';
COMMENT ON TABLE printers IS 'Printer assets assigned only to clients';
COMMENT ON COLUMN printers.client_id IS 'Reference to owning client (no employee assignment)';

-- Restore data from backup if it exists
DO $$
DECLARE
    client_record RECORD;
    printer_record RECORD;
    new_client_id INTEGER;
BEGIN
    -- Restore clients data
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'clients_backup' AND schemaname = 'pg_temp') THEN
        FOR client_record IN SELECT * FROM clients_backup LOOP
            INSERT INTO clients (id, name, pnumber, description, created_at, updated_at)
            VALUES (
                client_record.id,
                client_record.name,
                COALESCE(client_record.pnumber, client_record.client_id, 'CL' || client_record.id),
                client_record.description,
                COALESCE(client_record.created_at, CURRENT_TIMESTAMP),
                COALESCE(client_record.updated_at, CURRENT_TIMESTAMP)
            );
        END LOOP;

        -- Reset sequence to avoid conflicts
        SELECT setval('clients_id_seq', COALESCE(MAX(id), 1)) FROM clients;
        RAISE NOTICE 'Restored clients data with pnumber field';
    ELSE
        -- Insert default sample clients
        INSERT INTO clients (name, pnumber, description) VALUES
        ('Default Client', 'CL001', 'Default client for existing assets'),
        ('Sample Corporation', 'CL002', 'Sample client organization');
        RAISE NOTICE 'Created sample client records';
    END IF;

    -- Restore printers data (only with client assignments)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'printers_backup' AND schemaname = 'pg_temp') THEN
        FOR printer_record IN SELECT * FROM printers_backup LOOP
            -- Get or create a client for this printer
            IF printer_record.client_id IS NOT NULL THEN
                new_client_id := printer_record.client_id;
            ELSE
                -- Assign to default client if no client was assigned
                SELECT id INTO new_client_id FROM clients WHERE pnumber = 'CL001' LIMIT 1;
            END IF;

            INSERT INTO printers (
                id, name, brand, model, serial_number, ip_address, location,
                description, client_id, status_id, created_at, updated_at,
                created_by, updated_by
            ) VALUES (
                printer_record.id,
                printer_record.name,
                printer_record.brand,
                printer_record.model,
                printer_record.serial_number,
                printer_record.ip_address,
                printer_record.location,
                printer_record.description,
                new_client_id,
                printer_record.status_id,
                COALESCE(printer_record.created_at, CURRENT_TIMESTAMP),
                COALESCE(printer_record.updated_at, CURRENT_TIMESTAMP),
                printer_record.created_by,
                printer_record.updated_by
            );
        END LOOP;

        -- Reset sequence to avoid conflicts
        SELECT setval('printers_id_seq', COALESCE(MAX(id), 1)) FROM printers;
        RAISE NOTICE 'Restored printers data with client-only assignments';
    ELSE
        RAISE NOTICE 'No existing printers to restore';
    END IF;
END $$;

-- Update items table to reference clients properly if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
        -- Add client_id column to items if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'client_id') THEN
            ALTER TABLE items ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
            CREATE INDEX idx_items_client_id ON items(client_id);
            RAISE NOTICE 'Added client_id column to items table';
        END IF;
    END IF;
END $$;

-- Create update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON printers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for asset counts per client
CREATE OR REPLACE VIEW client_asset_summary AS
SELECT
    c.id,
    c.name,
    c.pnumber,
    c.description,
    c.created_at,
    c.updated_at,
    COALESCE(printer_count, 0) as printer_count,
    COALESCE(pda_count, 0) as pda_count,
    COALESCE(sim_card_count, 0) as sim_card_count,
    COALESCE(other_items_count, 0) as other_items_count,
    COALESCE(printer_count, 0) + COALESCE(pda_count, 0) + COALESCE(sim_card_count, 0) + COALESCE(other_items_count, 0) as total_assets
FROM clients c
LEFT JOIN (
    SELECT client_id, COUNT(*) as printer_count
    FROM printers
    WHERE client_id IS NOT NULL
    GROUP BY client_id
) p ON c.id = p.client_id
LEFT JOIN (
    SELECT client_id,
           SUM(CASE WHEN type_id IN (SELECT id FROM types WHERE name ILIKE '%PDA%') THEN 1 ELSE 0 END) as pda_count,
           SUM(CASE WHEN type_id IN (SELECT id FROM types WHERE name ILIKE '%SIM%') THEN 1 ELSE 0 END) as sim_card_count,
           SUM(CASE WHEN type_id NOT IN (SELECT id FROM types WHERE name ILIKE '%PDA%' OR name ILIKE '%SIM%') THEN 1 ELSE 0 END) as other_items_count
    FROM items
    WHERE client_id IS NOT NULL
    GROUP BY client_id
) i ON c.id = i.client_id;

COMMENT ON VIEW client_asset_summary IS 'Summary view of all assets assigned to each client';

-- Final verification
DO $$
DECLARE
    client_count INTEGER;
    printer_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO client_count FROM clients;
    SELECT COUNT(*) INTO printer_count FROM printers;

    RAISE NOTICE '✅ Migration completed successfully:';
    RAISE NOTICE '   - Clients table recreated with % records', client_count;
    RAISE NOTICE '   - Printers table recreated with % records', printer_count;
    RAISE NOTICE '   - All indexes and triggers created';
    RAISE NOTICE '   - Client asset summary view created';
END $$;

COMMIT;
