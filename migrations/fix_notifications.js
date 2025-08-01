// Run with: node scripts/fix_notifications.js

const { Client } = require('pg');

// Update these with your actual database credentials
const client = new Client({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'inventory_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

const sql = `
-- First, ensure the warranty columns exist in the items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

-- Create indexes for better performance on warranty queries
CREATE INDEX IF NOT EXISTS idx_items_warranty_end_date ON items(warranty_end_date);
CREATE INDEX IF NOT EXISTS idx_items_warranty_dates ON items(warranty_start_date, warranty_end_date)
WHERE warranty_end_date IS NOT NULL;

-- Create a function to automatically calculate warranty end date
CREATE OR REPLACE FUNCTION calculate_warranty_end_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warranty_start_date IS NOT NULL AND NEW.warranty_months IS NOT NULL THEN
        NEW.warranty_end_date := NEW.warranty_start_date + (NEW.warranty_months || ' months')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate warranty end date
DROP TRIGGER IF EXISTS trigger_calculate_warranty_end_date ON items;
CREATE TRIGGER trigger_calculate_warranty_end_date
    BEFORE INSERT OR UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_warranty_end_date();

-- Create a view for warranty status analysis
CREATE OR REPLACE VIEW warranty_status_view AS
SELECT
    i.id,
    i.cep_brc,
    i.name,
    i.warranty_start_date,
    i.warranty_months,
    i.warranty_end_date,
    t.name as type_name,
    b.name as brand_name,
    e.name as employee_name,
    e.id as employee_id,
    d.name as department_name,
    CASE
        WHEN i.warranty_end_date IS NULL THEN 'no_warranty'
        WHEN i.warranty_end_date < CURRENT_DATE THEN 'expired'
        WHEN i.warranty_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
        WHEN i.warranty_end_date BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_later'
        ELSE 'active'
    END as warranty_status,
    CASE
    WHEN i.warranty_end_date IS NULL THEN NULL
    WHEN i.warranty_end_date < CURRENT_DATE THEN
        -(CURRENT_DATE - i.warranty_end_date)
    ELSE
        (i.warranty_end_date - CURRENT_DATE)
END as days_until_expiry

FROM items i
LEFT JOIN types t ON i.type_id = t.id
LEFT JOIN brands b ON i.brand_id = b.id
LEFT JOIN employees e ON i.assigned_to = e.id
LEFT JOIN departments d ON e.dept_id = d.id;
`;

async function runMigration() {
  try {
    await client.connect();
    console.log("🚀 Connected to DB");
    await client.query(sql);
    console.log("✅ Warranty setup executed successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
    console.log("🛑 Connection closed");
  }
}

runMigration();
