-- Migration 019: Migrate Printers to Assets System
-- This migration moves printers from the separate printers table to the items (assets) table

-- First, ensure we have the printer type
INSERT INTO types (name, description)
VALUES ('Printer', 'Printing devices')
ON CONFLICT (name) DO NOTHING;

-- Get the printer type ID for the migration
DO $$
DECLARE
    printer_type_id INTEGER;
    rec RECORD;
BEGIN
    -- Get the printer type ID
    SELECT id INTO printer_type_id FROM types WHERE name = 'Printer';

    IF printer_type_id IS NULL THEN
        RAISE EXCEPTION 'Printer type not found in types table';
    END IF;

    -- Migrate existing printers to items table
    FOR rec IN
        SELECT
            p.id as printer_id,
            p.name,
            p.brand,
            p.model,
            p.client_id,
            NULL::decimal as cost,  -- cost column doesn't exist in current schema
            p.status_id,
            p.created_at,
            p.updated_at,
            -- Generate a unique CEP_BRC for each printer
            'PRT-' || LPAD(p.id::text, 6, '0') as cep_brc,
            -- Try to get brand_id from brands table, create if needed
            CASE
                WHEN p.brand IS NOT NULL AND p.brand != '' THEN
                    (SELECT b.id FROM brands b WHERE LOWER(b.name) = LOWER(p.brand) LIMIT 1)
                ELSE NULL
            END as existing_brand_id
    FROM printers p
    LOOP
        -- Insert brand if it doesn't exist and brand is provided
        IF rec.brand IS NOT NULL AND rec.brand != '' AND rec.existing_brand_id IS NULL THEN
            INSERT INTO brands (name) VALUES (rec.brand) ON CONFLICT (name) DO NOTHING;
            -- Get the brand ID after insertion
            SELECT id INTO rec.existing_brand_id FROM brands WHERE LOWER(name) = LOWER(rec.brand);
        END IF;

        -- Insert printer as an asset in items table
        INSERT INTO items (
            cep_brc,
            name,
            type_id,
            price,
            brand_id,
            model,
            serial_cod,
            receipt,
            date_assigned,
            assigned_to,
            status_id,
            location_id,
            warranty_start_date,
            warranty_end_date,
            warranty_months,
            notes,
            created_at,
            updated_at
        ) VALUES (
            rec.cep_brc,
            COALESCE(rec.name, rec.brand || ' ' || rec.model, 'Printer ' || rec.printer_id),
            printer_type_id,
            NULL, -- cost - not available in current printer table
            rec.existing_brand_id,
            rec.model,
            NULL, -- serial_cod - not available in old printer table
            NULL, -- receipt - not available in old printer table
            NULL, -- date_assigned - not available in old printer table
            NULL, -- assigned_to - printers were assigned to clients, not employees
            rec.status_id,
            NULL, -- location_id - not available in old printer table
            NULL, -- warranty_start_date - not available in old printer table
            NULL, -- warranty_end_date - not available in old printer table
            NULL, -- warranty_months - not available in old printer table
            'Migrated from printers table. Originally assigned to client_id: ' || COALESCE(rec.client_id::text, 'none'),
            rec.created_at,
            rec.updated_at
        );

        RAISE NOTICE 'Migrated printer ID % as asset %', rec.printer_id, rec.cep_brc;
    END LOOP;

    RAISE NOTICE 'Printer migration completed successfully';
END $$;

-- Create a view to maintain backward compatibility for client-printer assignments
-- Since printers are now assets, we need to track client assignments differently
-- We'll use the notes field or create a separate client_assets table

CREATE TABLE IF NOT EXISTS client_assets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, item_id)
);

-- Migrate client-printer relationships to client_assets
DO $$
DECLARE
    rec RECORD;
    asset_id INTEGER;
BEGIN
    FOR rec IN
        SELECT
            p.client_id,
            'PRT-' || LPAD(p.id::text, 6, '0') as cep_brc,
            p.created_at
        FROM printers p
        WHERE p.client_id IS NOT NULL
    LOOP
        -- Get the corresponding asset ID
        SELECT id INTO asset_id FROM items WHERE cep_brc = rec.cep_brc;

        IF asset_id IS NOT NULL THEN
            INSERT INTO client_assets (client_id, item_id, assigned_date, notes)
            VALUES (
                rec.client_id,
                asset_id,
                rec.created_at::date,
                'Migrated from printers table'
            )
            ON CONFLICT (client_id, item_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- Create indexes for the new client_assets table
CREATE INDEX IF NOT EXISTS idx_client_assets_client ON client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_item ON client_assets(item_id);

-- Update printer_history to reference items instead of printers
-- Create a new asset_history table that can handle all asset types
CREATE TABLE IF NOT EXISTS asset_history (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate printer history to asset history
DO $$
DECLARE
    rec RECORD;
    asset_id INTEGER;
BEGIN
    FOR rec IN
        SELECT
            ph.*,
            'PRT-' || LPAD(ph.printer_id::text, 6, '0') as cep_brc
        FROM printer_history ph
    LOOP
        -- Get the corresponding asset ID
        SELECT id INTO asset_id FROM items WHERE cep_brc = rec.cep_brc;

        IF asset_id IS NOT NULL THEN
            INSERT INTO asset_history (item_id, action_type, action_details, performed_by, created_at)
            VALUES (asset_id, rec.action_type, rec.action_details, rec.performed_by, rec.created_at);
        END IF;
    END LOOP;
END $$;

-- Create index for asset_history
CREATE INDEX IF NOT EXISTS idx_asset_history_item ON asset_history(item_id);

-- Drop the old printer-related tables (we'll keep them for now for safety)
-- DROP TABLE IF EXISTS printer_history CASCADE;
-- DROP TABLE IF EXISTS printers CASCADE;

-- Add a comment to mark these tables as deprecated
COMMENT ON TABLE printers IS 'DEPRECATED: Printers have been migrated to items table. This table will be removed in a future migration.';
COMMENT ON TABLE printer_history IS 'DEPRECATED: History has been migrated to asset_history table. This table will be removed in a future migration.';

-- Create a view for backward compatibility
CREATE OR REPLACE VIEW printers_view AS
SELECT
    i.id,
    i.name,
    b.name as brand,
    i.model,
    ca.client_id,
    i.price as cost,
    i.status_id,
    i.created_at,
    i.updated_at,
    i.cep_brc
FROM items i
LEFT JOIN brands b ON i.brand_id = b.id
LEFT JOIN client_assets ca ON ca.item_id = i.id
JOIN types t ON i.type_id = t.id
WHERE t.name = 'Printer';

COMMENT ON VIEW printers_view IS 'Backward compatibility view for printers now stored as assets in items table';
