-- Add color, icon, is_active, and status_order columns to statuses table

-- Add icon column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'statuses' AND column_name = 'icon') THEN
    ALTER TABLE statuses ADD COLUMN icon VARCHAR(100) DEFAULT 'fas fa-tag';
  END IF;
END $$;

-- Add color column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'statuses' AND column_name = 'color') THEN
    ALTER TABLE statuses ADD COLUMN color VARCHAR(50) DEFAULT 'gray';
  END IF;
END $$;

-- Add is_active column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'statuses' AND column_name = 'is_active') THEN
    ALTER TABLE statuses ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add status_order column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'statuses' AND column_name = 'status_order') THEN
    ALTER TABLE statuses ADD COLUMN status_order INTEGER DEFAULT 999;
  END IF;
END $$;

-- Update existing statuses with appropriate icons, colors, and order
UPDATE statuses SET
  icon = CASE
    WHEN LOWER(name) LIKE '%active%' THEN 'fas fa-check-circle'
    WHEN LOWER(name) LIKE '%storage%' THEN 'fas fa-box'
    WHEN LOWER(name) LIKE '%maintenance%' THEN 'fas fa-tools'
    WHEN LOWER(name) LIKE '%retired%' THEN 'fas fa-archive'
    WHEN LOWER(name) LIKE '%lost%' THEN 'fas fa-question-circle'
    WHEN LOWER(name) LIKE '%repair%' THEN 'fas fa-wrench'
    WHEN LOWER(name) LIKE '%new%' THEN 'fas fa-star'
    WHEN LOWER(name) LIKE '%available%' THEN 'fas fa-check'
    WHEN LOWER(name) LIKE '%assigned%' THEN 'fas fa-user-check'
    WHEN LOWER(name) LIKE '%damaged%' THEN 'fas fa-exclamation-triangle'
    WHEN LOWER(name) LIKE '%stolen%' THEN 'fas fa-ban'
    WHEN LOWER(name) LIKE '%returned%' THEN 'fas fa-undo'
    ELSE 'fas fa-tag'
  END,
  color = CASE
    WHEN LOWER(name) LIKE '%active%' THEN 'green'
    WHEN LOWER(name) LIKE '%storage%' THEN 'blue'
    WHEN LOWER(name) LIKE '%maintenance%' THEN 'yellow'
    WHEN LOWER(name) LIKE '%retired%' THEN 'gray'
    WHEN LOWER(name) LIKE '%lost%' THEN 'red'
    WHEN LOWER(name) LIKE '%repair%' THEN 'orange'
    WHEN LOWER(name) LIKE '%new%' THEN 'blue'
    WHEN LOWER(name) LIKE '%available%' THEN 'green'
    WHEN LOWER(name) LIKE '%assigned%' THEN 'green'
    WHEN LOWER(name) LIKE '%damaged%' THEN 'red'
    WHEN LOWER(name) LIKE '%stolen%' THEN 'red'
    WHEN LOWER(name) LIKE '%returned%' THEN 'blue'
    ELSE 'gray'
  END,
  status_order = CASE
    WHEN LOWER(name) LIKE '%active%' THEN 1
    WHEN LOWER(name) LIKE '%new%' THEN 2
    WHEN LOWER(name) LIKE '%available%' THEN 3
    WHEN LOWER(name) LIKE '%assigned%' THEN 4
    WHEN LOWER(name) LIKE '%storage%' THEN 5
    WHEN LOWER(name) LIKE '%maintenance%' THEN 6
    WHEN LOWER(name) LIKE '%repair%' THEN 7
    WHEN LOWER(name) LIKE '%retired%' THEN 8
    WHEN LOWER(name) LIKE '%damaged%' THEN 9
    WHEN LOWER(name) LIKE '%lost%' THEN 10
    WHEN LOWER(name) LIKE '%stolen%' THEN 11
    ELSE 999
  END
WHERE icon IS NULL OR color IS NULL OR status_order IS NULL;

-- Add more status options with colors and icons (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Available') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Available', 'Ready to be assigned', 'fas fa-check', 'green', TRUE, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Assigned') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Assigned', 'Currently assigned to an employee', 'fas fa-user-check', 'green', TRUE, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Under Repair') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Under Repair', 'Being repaired', 'fas fa-wrench', 'orange', TRUE, 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Damaged') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Damaged', 'Item is damaged and needs attention', 'fas fa-exclamation-triangle', 'red', TRUE, 9);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Stolen') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Stolen', 'Item reported as stolen', 'fas fa-ban', 'red', TRUE, 11);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Returned') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Returned', 'Item has been returned', 'fas fa-undo', 'blue', TRUE, 12);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Pending Assignment') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Pending Assignment', 'Waiting to be assigned', 'fas fa-clock', 'yellow', TRUE, 13);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Out for Delivery') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Out for Delivery', 'Item is being delivered', 'fas fa-shipping-fast', 'blue', TRUE, 14);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'In Transit') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('In Transit', 'Item is in transit', 'fas fa-truck', 'purple', TRUE, 15);
  END IF;
END $$;

-- Create index on status_order
CREATE INDEX IF NOT EXISTS idx_statuses_order ON statuses(status_order);
CREATE INDEX IF NOT EXISTS idx_statuses_active ON statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_statuses_color ON statuses(color);
