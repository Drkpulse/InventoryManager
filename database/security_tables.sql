-- Enhanced Security Tables for Inventory Management System
-- These tables track security events and provide audit trails

-- Table for tracking login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL, -- email, CEP ID, or IP address
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attempt_type VARCHAR(20) DEFAULT 'failed', -- 'failed', 'success', 'blocked'
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
  locked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMP,
  unlocked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced activity logs table (if not exists)
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'login_success', 'login_failed', 'permission_denied', 'suspicious_activity'
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  event_data JSONB, -- Additional event-specific data
  severity VARCHAR(20) DEFAULT 'info', -- 'low', 'medium', 'high', 'critical'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password history table (prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for password_history table
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history (user_id, created_at);

-- Session tracking table for enhanced session management
CREATE TABLE IF NOT EXISTS user_sessions (
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

-- Create indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions (last_activity);

-- CSRF tokens table for additional token validation
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE
);

-- Create indexes for csrf_tokens table
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_hash ON csrf_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session ON csrf_tokens (session_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens (expires_at);

-- API rate limiting table (if using database-based rate limiting)
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL, -- IP or user ID
  endpoint VARCHAR(255) NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (identifier, endpoint, window_start)
);

-- Create indexes for rate_limits table
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits (identifier, endpoint, window_start);

-- File upload logs for security monitoring
CREATE TABLE IF NOT EXISTS file_uploads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_filename VARCHAR(255),
  stored_filename VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_hash VARCHAR(255), -- SHA-256 hash of file content
  upload_ip INET,
  upload_path VARCHAR(500),
  scan_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'clean', 'infected', 'error'
  scan_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for file_uploads table
CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_hash ON file_uploads (file_hash);
CREATE INDEX IF NOT EXISTS idx_file_uploads_scan ON file_uploads (scan_status, created_at);

-- Create functions for automatic cleanup
CREATE OR REPLACE FUNCTION cleanup_security_tables()
RETURNS void AS $$
BEGIN
  -- Clean up old login attempts (older than 30 days)
  DELETE FROM login_attempts WHERE attempt_time < NOW() - INTERVAL '30 days';

  -- Clean up expired account lockouts
  DELETE FROM account_lockouts WHERE locked_until < NOW() - INTERVAL '24 hours';

  -- Clean up old security events (older than 90 days for low severity)
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity IN ('low', 'info');

  -- Clean up old security events (older than 1 year for medium/high severity)
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '1 year'
    AND severity IN ('medium', 'high');

  -- Clean up expired CSRF tokens
  DELETE FROM csrf_tokens WHERE expires_at < NOW();

  -- Clean up expired sessions
  DELETE FROM user_sessions WHERE expires_at < NOW();

  -- Clean up old rate limit records (older than 24 hours)
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '24 hours';

  -- Clean up old password history (keep only last 5 passwords per user)
  DELETE FROM password_history
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM password_history
    ) t WHERE t.rn <= 5
  );

  RAISE NOTICE 'Security tables cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Create all indexes after tables are created
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempt_time);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_identifier ON account_lockouts (identifier);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_until ON account_lockouts (locked_until);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts (identifier, locked_until);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events (ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events (severity, created_at);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions (last_activity);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_hash ON csrf_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session ON csrf_tokens (session_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits (identifier, endpoint, window_start);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_hash ON file_uploads (file_hash);
CREATE INDEX IF NOT EXISTS idx_file_uploads_scan ON file_uploads (scan_status, created_at);

-- Create indexes for better performance on users table
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, active);
CREATE INDEX IF NOT EXISTS idx_users_cep_active ON users(cep_id, active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts);

-- Add constraints for data integrity
ALTER TABLE login_attempts ADD CONSTRAINT chk_attempt_type
  CHECK (attempt_type IN ('failed', 'success', 'blocked'));

ALTER TABLE account_lockouts ADD CONSTRAINT chk_locked_until_future
  CHECK (locked_until > locked_at);

ALTER TABLE security_events ADD CONSTRAINT chk_severity
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Create trigger for automatic password history
CREATE OR REPLACE FUNCTION save_password_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save if password actually changed
  IF OLD.password IS DISTINCT FROM NEW.password THEN
    INSERT INTO password_history (user_id, password_hash)
    VALUES (NEW.id, NEW.password);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_save_password_history
  AFTER UPDATE OF password ON users
  FOR EACH ROW EXECUTE FUNCTION save_password_history();

-- Create function to check password reuse
CREATE OR REPLACE FUNCTION check_password_reuse(p_user_id INTEGER, p_password_hash VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM password_history
    WHERE user_id = p_user_id
      AND password_hash = p_password_hash
    ORDER BY created_at DESC
    LIMIT 5 -- Check last 5 passwords
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE login_attempts IS 'Tracks all login attempts for security monitoring';
COMMENT ON TABLE account_lockouts IS 'Manages account lockouts due to security violations';
COMMENT ON TABLE security_events IS 'Comprehensive security event logging';
COMMENT ON TABLE password_history IS 'Prevents password reuse by storing password hashes';
COMMENT ON TABLE user_sessions IS 'Enhanced session tracking for security';
COMMENT ON TABLE csrf_tokens IS 'CSRF token validation and tracking';
COMMENT ON TABLE rate_limits IS 'Database-based rate limiting storage';
COMMENT ON TABLE file_uploads IS 'File upload tracking and security scanning';
