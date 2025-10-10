-- Purpose: Create security tables including user_sessions, login_attempts, and related tables
-- Migration: 007_create_security_tables.sql

-- ===== SECURITY TABLES CREATION =====

-- Drop existing security tables if they exist (to ensure clean recreation)
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS account_lockouts CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS csrf_tokens CASCADE;
DROP TABLE IF EXISTS api_tokens CASCADE;
DROP TABLE IF EXISTS user_2fa CASCADE;

-- Verify users table exists with id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'id'
    ) THEN
        RAISE EXCEPTION 'Users table with id column must exist before creating security tables';
    END IF;
    RAISE NOTICE 'Users table verified, proceeding with security table creation';
END $$;

-- Table for tracking login attempts
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attempt_type VARCHAR(20) DEFAULT 'failed',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for account lockouts
CREATE TABLE account_lockouts (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) UNIQUE NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  reason VARCHAR(100) DEFAULT 'too_many_failed_attempts',
  locked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMP,
  unlocked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced security events table
CREATE TABLE security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  event_data JSONB,
  severity VARCHAR(20) DEFAULT 'info',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password history table
CREATE TABLE password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session tracking table
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  logout_time TIMESTAMP
);

-- CSRF tokens table
CREATE TABLE csrf_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);

-- API tokens table
CREATE TABLE api_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  permissions JSONB,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Two-factor authentication table
CREATE TABLE user_2fa (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret VARCHAR(32) NOT NULL,
  backup_codes TEXT[],
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP
);

-- ===== INDEXES =====
-- Create comprehensive indexes for all security tables

-- Indexes for login_attempts
CREATE INDEX idx_login_attempts_identifier ON login_attempts (identifier);
CREATE INDEX idx_login_attempts_ip ON login_attempts (ip_address);
CREATE INDEX idx_login_attempts_time ON login_attempts (attempt_time);
CREATE INDEX idx_login_attempts_user ON login_attempts (user_id);
CREATE INDEX idx_login_attempts_type ON login_attempts (attempt_type);

-- Indexes for account_lockouts
CREATE INDEX idx_account_lockouts_identifier ON account_lockouts (identifier);
CREATE INDEX idx_account_lockouts_locked_until ON account_lockouts (locked_until);

-- Indexes for security_events
CREATE INDEX idx_security_events_type ON security_events (event_type);
CREATE INDEX idx_security_events_user ON security_events (user_id);
CREATE INDEX idx_security_events_time ON security_events (created_at);
CREATE INDEX idx_security_events_severity ON security_events (severity);

-- Indexes for password_history
CREATE INDEX idx_password_history_user ON password_history (user_id);

-- Indexes for user_sessions
CREATE INDEX idx_user_sessions_session ON user_sessions (session_id);
CREATE INDEX idx_user_sessions_user ON user_sessions (user_id, is_active);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_activity ON user_sessions (last_activity);

-- Indexes for csrf_tokens
CREATE INDEX idx_csrf_tokens_user ON csrf_tokens (user_id);
CREATE INDEX idx_csrf_tokens_expires ON csrf_tokens (expires_at);
CREATE INDEX idx_csrf_tokens_token ON csrf_tokens (token);

-- Indexes for api_tokens
CREATE INDEX idx_api_tokens_user ON api_tokens (user_id);
CREATE INDEX idx_api_tokens_active ON api_tokens (is_active);

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
  p_user_id INTEGER DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id VARCHAR(255) DEFAULT NULL,
  p_event_data JSONB DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT 'info'
) RETURNS VOID AS $$
BEGIN
  -- Safe insert with error handling
  BEGIN
    INSERT INTO security_events (
      event_type, user_id, ip_address, user_agent,
      session_id, event_data, severity, created_at
    ) VALUES (
      p_event_type, p_user_id, p_ip_address, p_user_agent,
      p_session_id, p_event_data, p_severity, CURRENT_TIMESTAMP
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- If there's any error, at least log the event type and timestamp
      INSERT INTO security_events (event_type, created_at)
      VALUES (p_event_type, CURRENT_TIMESTAMP);
  END;
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

-- ===== FOREIGN KEY CONSTRAINTS =====
-- Foreign key constraints will be added by a separate migration after all tables exist
-- This ensures proper dependency order and avoids constraint errors

-- Note: Foreign key constraints for security tables will be added by migration 012_verify_security_schema.sql
