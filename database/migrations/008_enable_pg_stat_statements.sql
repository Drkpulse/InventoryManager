-- Purpose: Create security tables with proper user reference handling
-- Migration: 007_create_security_tables.sql

-- ===== SECURITY TABLES CREATION (FIXED) =====

-- First, check what user table structure we have
DO $$
DECLARE
    user_table_exists BOOLEAN;
    user_id_column_exists BOOLEAN;
    users_primary_key TEXT;
BEGIN
    -- Check if users table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
    ) INTO user_table_exists;

    IF user_table_exists THEN
        -- Check if users table has id column
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'id'
        ) INTO user_id_column_exists;

        -- Get the primary key column name
        SELECT column_name INTO users_primary_key
        FROM information_schema.key_column_usage k
        JOIN information_schema.table_constraints t
            ON t.constraint_name = k.constraint_name
        WHERE t.table_name = 'users' AND t.constraint_type = 'PRIMARY KEY'
        LIMIT 1;

        RAISE NOTICE 'Users table exists. Has id column: %, Primary key: %', user_id_column_exists, COALESCE(users_primary_key, 'NONE');
    ELSE
        RAISE NOTICE 'Users table does not exist yet';
    END IF;
END $$;

-- Table for tracking login attempts (without foreign keys initially)
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attempt_type VARCHAR(20) DEFAULT 'failed',
  user_reference VARCHAR(255), -- Generic user reference (could be id, email, username)
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) UNIQUE NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  reason VARCHAR(100) DEFAULT 'too_many_failed_attempts',
  locked_by_user VARCHAR(255),
  unlocked_at TIMESTAMP,
  unlocked_by_user VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced security events table
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_reference VARCHAR(255), -- Generic user reference
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  event_data JSONB,
  severity VARCHAR(20) DEFAULT 'info',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password history table
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_reference VARCHAR(255), -- Generic user reference
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session tracking table
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_reference VARCHAR(255), -- Generic user reference
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  logout_time TIMESTAMP
);

-- CSRF tokens table
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  user_reference VARCHAR(255), -- Generic user reference
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);

-- API tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  user_reference VARCHAR(255), -- Generic user reference
  name VARCHAR(100),
  permissions JSONB,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Two-factor authentication table
CREATE TABLE IF NOT EXISTS user_2fa (
  id SERIAL PRIMARY KEY,
  user_reference VARCHAR(255) UNIQUE, -- Generic user reference
  secret VARCHAR(32) NOT NULL,
  backup_codes TEXT[],
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP
);

-- ===== INDEXES =====

-- Indexes for login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_ref ON login_attempts (user_reference);

-- Indexes for account_lockouts
CREATE INDEX IF NOT EXISTS idx_account_lockouts_identifier ON account_lockouts (identifier);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until ON account_lockouts (locked_until);

-- Indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_ref ON security_events (user_reference);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events (created_at);

-- Indexes for password_history
CREATE INDEX IF NOT EXISTS idx_password_history_user_ref ON password_history (user_reference);

-- Indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_ref ON user_sessions (user_reference, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions (last_activity);

-- Indexes for csrf_tokens
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user_ref ON csrf_tokens (user_reference);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens (expires_at);

-- Indexes for api_tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_ref ON api_tokens (user_reference);
CREATE INDEX IF NOT EXISTS idx_api_tokens_active ON api_tokens (is_active);

-- ===== FUNCTIONS AND PROCEDURES =====

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM csrf_tokens WHERE expires_at < NOW();

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type VARCHAR(50),
  p_user_reference VARCHAR(255) DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id VARCHAR(255) DEFAULT NULL,
  p_event_data JSONB DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT 'info'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO security_events (
    event_type, user_reference, ip_address, user_agent,
    session_id, event_data, severity
  ) VALUES (
    p_event_type, p_user_reference, p_ip_address, p_user_agent,
    p_session_id, p_event_data, p_severity
  );
END;
$$ LANGUAGE plpgsql;

-- ===== COMMENTS =====

COMMENT ON TABLE login_attempts IS 'Tracks failed and successful login attempts for security monitoring';
COMMENT ON TABLE account_lockouts IS 'Manages account lockouts due to security violations';
COMMENT ON TABLE security_events IS 'Comprehensive security event logging';
COMMENT ON TABLE password_history IS 'Tracks password changes to prevent reuse';
COMMENT ON TABLE user_sessions IS 'Enhanced session tracking for security';
COMMENT ON TABLE csrf_tokens IS 'CSRF protection tokens';
COMMENT ON TABLE api_tokens IS 'API authentication tokens';
COMMENT ON TABLE user_2fa IS 'Two-factor authentication settings';

COMMENT ON COLUMN login_attempts.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN security_events.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN password_history.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN user_sessions.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN csrf_tokens.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN api_tokens.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';
COMMENT ON COLUMN user_2fa.user_reference IS 'Generic user reference - could be id, email, or username depending on user table structure';

-- Migration completed successfully
SELECT 'Security tables created successfully with generic user references' as migration_status;
