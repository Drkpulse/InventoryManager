-- Add support for emojis and RGB colors in statuses table

-- Extend icon column to support emojis and longer icon names
ALTER TABLE statuses ALTER COLUMN icon TYPE VARCHAR(255);

-- Extend color column to support RGB values (#RRGGBB format)
ALTER TABLE statuses ALTER COLUMN color TYPE VARCHAR(100);

-- Add predefined emojis and RGB colors for new statuses
UPDATE statuses SET
  icon = CASE
    WHEN LOWER(name) LIKE '%active%' THEN '✅'
    WHEN LOWER(name) LIKE '%storage%' THEN '📦'
    WHEN LOWER(name) LIKE '%maintenance%' THEN '🔧'
    WHEN LOWER(name) LIKE '%retired%' THEN '📄'
    WHEN LOWER(name) LIKE '%lost%' THEN '❓'
    WHEN LOWER(name) LIKE '%repair%' THEN '🛠️'
    WHEN LOWER(name) LIKE '%new%' THEN '⭐'
    WHEN LOWER(name) LIKE '%available%' THEN '✅'
    WHEN LOWER(name) LIKE '%assigned%' THEN '👤'
    WHEN LOWER(name) LIKE '%damaged%' THEN '⚠️'
    WHEN LOWER(name) LIKE '%stolen%' THEN '🚫'
    WHEN LOWER(name) LIKE '%returned%' THEN '↩️'
    ELSE icon -- Keep existing FontAwesome icons if not matching patterns
  END,
  color = CASE
    WHEN LOWER(name) LIKE '%active%' THEN '#10B981'
    WHEN LOWER(name) LIKE '%storage%' THEN '#3B82F6'
    WHEN LOWER(name) LIKE '%maintenance%' THEN '#F59E0B'
    WHEN LOWER(name) LIKE '%retired%' THEN '#6B7280'
    WHEN LOWER(name) LIKE '%lost%' THEN '#EF4444'
    WHEN LOWER(name) LIKE '%repair%' THEN '#F97316'
    WHEN LOWER(name) LIKE '%new%' THEN '#3B82F6'
    WHEN LOWER(name) LIKE '%available%' THEN '#10B981'
    WHEN LOWER(name) LIKE '%assigned%' THEN '#059669'
    WHEN LOWER(name) LIKE '%damaged%' THEN '#DC2626'
    WHEN LOWER(name) LIKE '%stolen%' THEN '#B91C1C'
    WHEN LOWER(name) LIKE '%returned%' THEN '#2563EB'
    ELSE color -- Keep existing colors if not matching patterns
  END;

-- Insert some additional predefined statuses with emojis and RGB colors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Pending Review') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Pending Review', 'Awaiting review or approval', '👁️', '#8B5CF6', TRUE, 16);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Quarantine') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Quarantine', 'Isolated for inspection or cleaning', '🔒', '#F59E0B', TRUE, 17);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Backup') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Backup', 'Kept as backup or spare', '💾', '#6366F1', TRUE, 18);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Disposed') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Disposed', 'Properly disposed of', '🗑️', '#374151', TRUE, 19);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Testing') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Testing', 'Currently being tested', '🧪', '#EC4899', TRUE, 20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM statuses WHERE name = 'Reserved') THEN
    INSERT INTO statuses (name, description, icon, color, is_active, status_order) VALUES
    ('Reserved', 'Reserved for future use', '🔖', '#14B8A6', TRUE, 21);
  END IF;
END $$;
