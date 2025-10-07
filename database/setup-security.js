#!/usr/bin/env node

/**
 * Simple Security Tables Setup
 * Creates security tables directly without complex SQL parsing
 */

const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'asset_manager',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

async function createSecurityTables() {
    const pool = new Pool(dbConfig);
    let client;

    try {
        console.log('🔄 Creating security tables...');
        client = await pool.connect();

        // Create tables one by one
        const tables = [
            {
                name: 'login_attempts',
                sql: `
                CREATE TABLE IF NOT EXISTS login_attempts (
                  id SERIAL PRIMARY KEY,
                  identifier VARCHAR(255) NOT NULL,
                  ip_address INET NOT NULL,
                  user_agent TEXT,
                  attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  attempt_type VARCHAR(20) DEFAULT 'failed',
                  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  session_id VARCHAR(255),
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'account_lockouts',
                sql: `
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
                )`
            },
            {
                name: 'security_events',
                sql: `
                CREATE TABLE IF NOT EXISTS security_events (
                  id SERIAL PRIMARY KEY,
                  event_type VARCHAR(50) NOT NULL,
                  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  ip_address INET,
                  user_agent TEXT,
                  session_id VARCHAR(255),
                  event_data JSONB,
                  severity VARCHAR(20) DEFAULT 'info',
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'password_history',
                sql: `
                CREATE TABLE IF NOT EXISTS password_history (
                  id SERIAL PRIMARY KEY,
                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  password_hash VARCHAR(255) NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'user_sessions',
                sql: `
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
                )`
            },
            {
                name: 'csrf_tokens',
                sql: `
                CREATE TABLE IF NOT EXISTS csrf_tokens (
                  id SERIAL PRIMARY KEY,
                  token_hash VARCHAR(255) UNIQUE NOT NULL,
                  session_id VARCHAR(255) NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  used_at TIMESTAMP,
                  expires_at TIMESTAMP NOT NULL,
                  is_used BOOLEAN DEFAULT FALSE
                )`
            },
            {
                name: 'rate_limits',
                sql: `
                CREATE TABLE IF NOT EXISTS rate_limits (
                  id SERIAL PRIMARY KEY,
                  identifier VARCHAR(255) NOT NULL,
                  endpoint VARCHAR(255) NOT NULL,
                  count INTEGER DEFAULT 1,
                  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  UNIQUE (identifier, endpoint, window_start)
                )`
            },
            {
                name: 'file_uploads',
                sql: `
                CREATE TABLE IF NOT EXISTS file_uploads (
                  id SERIAL PRIMARY KEY,
                  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  original_filename VARCHAR(255),
                  stored_filename VARCHAR(255),
                  file_size BIGINT,
                  mime_type VARCHAR(100),
                  file_hash VARCHAR(255),
                  upload_ip INET,
                  upload_path VARCHAR(500),
                  scan_status VARCHAR(20) DEFAULT 'pending',
                  scan_result JSONB,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            }
        ];

        // Create each table
        for (const table of tables) {
            try {
                await client.query(table.sql);
                console.log(`✅ Table '${table.name}' created/verified`);
            } catch (error) {
                if (error.code === '42P07') {
                    console.log(`⚠️  Table '${table.name}' already exists`);
                } else {
                    throw error;
                }
            }
        }

        // Create indexes
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier, attempt_time)',
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, attempt_time)',
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts (attempt_time)',
            'CREATE INDEX IF NOT EXISTS idx_account_lockouts_identifier ON account_lockouts (identifier)',
            'CREATE INDEX IF NOT EXISTS idx_account_lockouts_until ON account_lockouts (locked_until)',
            'CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts (identifier, locked_until)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events (event_type, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events (user_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events (ip_address, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events (severity, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history (user_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions (session_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions (last_activity)',
            'CREATE INDEX IF NOT EXISTS idx_csrf_tokens_hash ON csrf_tokens (token_hash)',
            'CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session ON csrf_tokens (session_id)',
            'CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens (expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits (identifier, endpoint, window_start)',
            'CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads (user_id, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_file_uploads_hash ON file_uploads (file_hash)',
            'CREATE INDEX IF NOT EXISTS idx_file_uploads_scan ON file_uploads (scan_status, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, active)',
            'CREATE INDEX IF NOT EXISTS idx_users_cep_active ON users(cep_id, active)',
            'CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)',
            'CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts)'
        ];

        console.log('🔧 Creating indexes...');
        for (const index of indexes) {
            try {
                await client.query(index);
            } catch (error) {
                console.log(`⚠️  Index might already exist: ${error.message}`);
            }
        }

        console.log('🎉 Security tables setup completed!');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    createSecurityTables();
}

module.exports = { createSecurityTables };
