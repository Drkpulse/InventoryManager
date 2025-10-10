-- Purpose: Validate all migrations and ensure consistency
-- Migration: 014_validate_migration_consistency.sql
-- Date: 2025-10-07
-- Description: Comprehensive check of all database structures and migrations

-- ===== VALIDATION CHECKS =====

-- Check 1: Verify core tables exist
DO $$
DECLARE
    missing_tables TEXT[] := '{}';
    table_name TEXT;
    tables_to_check TEXT[] := ARRAY[
        'users', 'departments', 'software', 'statuses', 'locations', 'employees',
        'types', 'brands', 'sales', 'items', 'license_config',
        'login_attempts', 'account_lockouts', 'security_events', 'password_history',
        'user_sessions', 'csrf_tokens', 'api_tokens', 'user_2fa'
    ];
BEGIN
    RAISE NOTICE '=== CHECKING CORE TABLES ===';

    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = table_name AND table_schema = 'public'
        ) THEN
            missing_tables := missing_tables || table_name;
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing core tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ All core tables exist';
    END IF;
END $$;

-- Check 2: Verify users table has required lockout columns
DO $$
DECLARE
    missing_columns TEXT[] := '{}';
    column_name TEXT;
    columns_to_check TEXT[] := ARRAY[
        'failed_login_attempts', 'account_locked', 'locked_at', 'locked_until', 'login_attempts', 'last_failed_login'
    ];
BEGIN
    RAISE NOTICE '=== CHECKING USERS TABLE LOCKOUT COLUMNS ===';

    FOREACH column_name IN ARRAY columns_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = column_name
        ) THEN
            missing_columns := missing_columns || column_name;
        END IF;
    END LOOP;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE WARNING 'Missing users lockout columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All users lockout columns exist';
    END IF;
END $$;

-- Check 3: Verify foreign key constraints exist
DO $$
DECLARE
    missing_fks TEXT[] := '{}';
    constraint_name TEXT;
    constraints_to_check TEXT[] := ARRAY[
        'login_attempts_user_id_fkey',
        'account_lockouts_locked_by_user_id_fkey',
        'account_lockouts_unlocked_by_user_id_fkey',
        'security_events_user_id_fkey',
        'password_history_user_id_fkey',
        'user_sessions_user_id_fkey',
        'csrf_tokens_user_id_fkey',
        'api_tokens_user_id_fkey',
        'user_2fa_user_id_fkey'
    ];
BEGIN
    RAISE NOTICE '=== CHECKING FOREIGN KEY CONSTRAINTS ===';

    FOREACH constraint_name IN ARRAY constraints_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = constraint_name AND table_schema = 'public'
        ) THEN
            missing_fks := missing_fks || constraint_name;
        END IF;
    END LOOP;

    IF array_length(missing_fks, 1) > 0 THEN
        RAISE WARNING 'Missing foreign key constraints: %', array_to_string(missing_fks, ', ');
    ELSE
        RAISE NOTICE '✅ All required foreign key constraints exist';
    END IF;
END $$;

-- Check 4: Verify essential indexes exist
DO $$
DECLARE
    missing_indexes TEXT[] := '{}';
    index_name TEXT;
    indexes_to_check TEXT[] := ARRAY[
        'idx_users_lockout',
        'idx_users_failed_attempts',
        'idx_login_attempts_identifier',
        'idx_login_attempts_user',
        'idx_security_events_user',
        'idx_user_sessions_session',
        'idx_csrf_tokens_user'
    ];
BEGIN
    RAISE NOTICE '=== CHECKING ESSENTIAL INDEXES ===';

    FOREACH index_name IN ARRAY indexes_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE indexname = index_name AND schemaname = 'public'
        ) THEN
            missing_indexes := missing_indexes || index_name;
        END IF;
    END LOOP;

    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE WARNING 'Missing essential indexes: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE '✅ All essential indexes exist';
    END IF;
END $$;

-- Check 5: Verify essential functions exist
DO $$
DECLARE
    missing_functions TEXT[] := '{}';
    function_name TEXT;
    functions_to_check TEXT[] := ARRAY[
        'find_user_by_login',
        'cleanup_expired_sessions',
        'log_security_event',
        'is_account_locked'
    ];
BEGIN
    RAISE NOTICE '=== CHECKING ESSENTIAL FUNCTIONS ===';

    FOREACH function_name IN ARRAY functions_to_check
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_name = function_name AND routine_schema = 'public'
        ) THEN
            missing_functions := missing_functions || function_name;
        END IF;
    END LOOP;

    IF array_length(missing_functions, 1) > 0 THEN
        RAISE WARNING 'Missing essential functions: %', array_to_string(missing_functions, ', ');
    ELSE
        RAISE NOTICE '✅ All essential functions exist';
    END IF;
END $$;

-- Check 6: Test critical functionality
DO $$
DECLARE
    test_result RECORD;
    function_works BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== TESTING CRITICAL FUNCTIONALITY ===';

    -- Test find_user_by_login function
    BEGIN
        SELECT * FROM find_user_by_login('admin@example.com') INTO test_result;
        function_works := TRUE;
        RAISE NOTICE '✅ find_user_by_login function works correctly';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING '❌ find_user_by_login function failed: %', SQLERRM;
    END;

    -- Test security events logging
    BEGIN
        PERFORM log_security_event('validation_test', NULL, NULL, NULL, NULL, '{"test": true}'::jsonb, 'info');
        RAISE NOTICE '✅ log_security_event function works correctly';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING '❌ log_security_event function failed: %', SQLERRM;
    END;

    -- Test is_account_locked function
    BEGIN
        SELECT * FROM is_account_locked('admin@example.com') INTO test_result;
        RAISE NOTICE '✅ is_account_locked function works correctly';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING '❌ is_account_locked function failed: %', SQLERRM;
    END;
END $$;

-- Check 7: Verify license configuration
DO $$
DECLARE
    license_count INTEGER;
    bypass_exists BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== CHECKING LICENSE CONFIGURATION ===';

    SELECT COUNT(*) FROM license_config INTO license_count;

    IF license_count = 0 THEN
        RAISE WARNING 'No license configuration found';
    ELSE
        RAISE NOTICE '✅ License configuration table has % entries', license_count;

        -- Check for bypass license
        SELECT EXISTS(SELECT 1 FROM license_config WHERE license_key = 'iambeirao') INTO bypass_exists;

        IF bypass_exists THEN
            RAISE NOTICE '✅ Bypass license (iambeirao) exists for development';
        ELSE
            RAISE WARNING 'Bypass license (iambeirao) not found';
        END IF;
    END IF;
END $$;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION VALIDATION COMPLETE ===';
    RAISE NOTICE 'Database structure validation finished.';
    RAISE NOTICE 'Check the messages above for any warnings or missing components.';
    RAISE NOTICE '';
END $$;
