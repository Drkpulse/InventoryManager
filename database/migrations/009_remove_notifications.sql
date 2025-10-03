-- Remove notification system from database
-- Migration: 009_remove_notifications

-- Drop notification-related indexes first
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_type_id;
DROP INDEX IF EXISTS idx_notifications_user_id;

-- Drop notification tables in reverse dependency order
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_types CASCADE;

-- Remove notification preferences from user settings
-- First check if settings column exists and has notification preferences
DO $$
BEGIN
    -- Remove notification-related fields from user settings JSON
    UPDATE users
    SET settings = settings - 'email_notifications' - 'browser_notifications' - 'sound_notifications' - 'assignment_notifications'
    WHERE settings IS NOT NULL
    AND (
        settings ? 'email_notifications' OR
        settings ? 'browser_notifications' OR
        settings ? 'sound_notifications' OR
        settings ? 'assignment_notifications'
    );

    RAISE NOTICE 'Notification preferences removed from user settings';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update user settings: %', SQLERRM;
END $$;
