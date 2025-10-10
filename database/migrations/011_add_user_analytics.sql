-- Enhanced User Analytics Tables for Performance Tracking
-- Migration: 011_add_user_analytics.sql

-- User Analytics Events table for detailed user behavior tracking
CREATE TABLE IF NOT EXISTS user_analytics_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER,
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'click', 'form_submit', 'search', 'download', etc.
  page_url VARCHAR(500),
  page_title VARCHAR(200),
  element_id VARCHAR(100),
  element_class VARCHAR(100),
  element_text TEXT,
  time_spent_seconds INTEGER, -- Time spent on page or element
  scroll_depth FLOAT, -- Percentage of page scrolled
  click_x INTEGER, -- Mouse click coordinates
  click_y INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- For storing additional custom data
);

-- Page Performance Metrics table
CREATE TABLE IF NOT EXISTS page_performance_metrics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER,
  page_url VARCHAR(500) NOT NULL,
  page_title VARCHAR(200),
  load_time_ms INTEGER, -- Page load time in milliseconds
  dom_ready_time_ms INTEGER,
  first_contentful_paint_ms INTEGER,
  largest_contentful_paint_ms INTEGER,
  cumulative_layout_shift FLOAT,
  first_input_delay_ms INTEGER,
  interaction_to_next_paint_ms INTEGER,
  memory_used_mb FLOAT,
  connection_type VARCHAR(50),
  device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
  browser VARCHAR(100),
  browser_version VARCHAR(50),
  os VARCHAR(100),
  screen_resolution VARCHAR(20),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Session Summary table for aggregated session data
CREATE TABLE IF NOT EXISTS user_session_summary (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  total_duration_seconds INTEGER,
  pages_visited INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_scroll_depth FLOAT DEFAULT 0,
  bounce_rate BOOLEAN DEFAULT FALSE, -- True if single page visit < 30 seconds
  conversion_events INTEGER DEFAULT 0, -- Forms submitted, downloads, etc.
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  exit_page VARCHAR(500),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  is_mobile BOOLEAN DEFAULT FALSE,
  country_code VARCHAR(5),
  city VARCHAR(100),
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cookie Consent Analytics table
CREATE TABLE IF NOT EXISTS cookie_consent_analytics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id INTEGER,
  consent_type VARCHAR(50) NOT NULL, -- 'accepted_all', 'rejected_all', 'customized', 'dismissed'
  performance_cookies BOOLEAN DEFAULT FALSE,
  preference_cookies BOOLEAN DEFAULT FALSE,
  analytics_cookies BOOLEAN DEFAULT FALSE,
  marketing_cookies BOOLEAN DEFAULT FALSE,
  consent_method VARCHAR(50), -- 'popup', 'banner', 'settings_page'
  time_to_consent_seconds INTEGER, -- How long user took to make decision
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Website Performance Aggregates table for quick dashboard queries
CREATE TABLE IF NOT EXISTS performance_aggregates (
  id SERIAL PRIMARY KEY,
  date_period DATE NOT NULL,
  period_type VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'monthly'
  unique_visitors INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_seconds FLOAT DEFAULT 0,
  avg_pages_per_session FLOAT DEFAULT 0,
  avg_load_time_ms FLOAT DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  conversion_rate FLOAT DEFAULT 0,
  cookie_consent_rate FLOAT DEFAULT 0,
  mobile_visitors_percentage FLOAT DEFAULT 0,
  top_pages JSONB,
  top_browsers JSONB,
  top_devices JSONB,
  performance_score FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance (with error handling for user_id indexes)
DO $$
BEGIN
    -- Safe indexes that don't depend on user relationships
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON user_analytics_events (session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON user_analytics_events (event_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON user_analytics_events (page_url, timestamp);

    CREATE INDEX IF NOT EXISTS idx_performance_metrics_session ON page_performance_metrics (session_id);
    CREATE INDEX IF NOT EXISTS idx_performance_metrics_page ON page_performance_metrics (page_url, timestamp);

    CREATE INDEX IF NOT EXISTS idx_session_summary_session ON user_session_summary (session_id);
    CREATE INDEX IF NOT EXISTS idx_session_summary_time ON user_session_summary (start_time, end_time);

    CREATE INDEX IF NOT EXISTS idx_cookie_consent_session ON cookie_consent_analytics (session_id);
    CREATE INDEX IF NOT EXISTS idx_cookie_consent_type ON cookie_consent_analytics (consent_type, timestamp);

    CREATE INDEX IF NOT EXISTS idx_performance_aggregates_date ON performance_aggregates (date_period, period_type);

    -- User_id dependent indexes with error handling
    BEGIN
        CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON user_analytics_events (user_id, timestamp);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Could not create user_analytics_events user_id index: %', SQLERRM;
    END;

    BEGIN
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_user ON page_performance_metrics (user_id, timestamp);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Could not create page_performance_metrics user_id index: %', SQLERRM;
    END;

    BEGIN
        CREATE INDEX IF NOT EXISTS idx_session_summary_user ON user_session_summary (user_id, start_time);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Could not create user_session_summary user_id index: %', SQLERRM;
    END;

    BEGIN
        CREATE INDEX IF NOT EXISTS idx_cookie_consent_user ON cookie_consent_analytics (user_id, timestamp);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Could not create cookie_consent_analytics user_id index: %', SQLERRM;
    END;

    RAISE NOTICE 'Analytics indexes created with error handling for user_id dependencies';
END $$;

-- Function to update performance aggregates
CREATE OR REPLACE FUNCTION update_performance_aggregates(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO performance_aggregates (
    date_period,
    unique_visitors,
    total_page_views,
    total_sessions,
    avg_session_duration_seconds,
    avg_pages_per_session,
    avg_load_time_ms,
    bounce_rate,
    conversion_rate,
    cookie_consent_rate,
    mobile_visitors_percentage,
    performance_score
  )
  SELECT
    target_date,
    COUNT(DISTINCT COALESCE(uss.user_id, uss.session_id)) as unique_visitors,
    SUM(COALESCE(uss.pages_visited, 0)) as total_page_views,
    COUNT(*) as total_sessions,
    AVG(COALESCE(uss.total_duration_seconds, 0)) as avg_session_duration_seconds,
    AVG(COALESCE(uss.pages_visited, 0)) as avg_pages_per_session,
    (
      SELECT AVG(ppm.load_time_ms)
      FROM page_performance_metrics ppm
      WHERE DATE(ppm.timestamp) = target_date
    ) as avg_load_time_ms,
    AVG(CASE WHEN uss.bounce_rate THEN 1.0 ELSE 0.0 END) * 100 as bounce_rate,
    (
      SELECT COUNT(*)::FLOAT / NULLIF(COUNT(DISTINCT session_id), 0) * 100
      FROM user_analytics_events
      WHERE event_type = 'conversion' AND DATE(timestamp) = target_date
    ) as conversion_rate,
    (
      SELECT COUNT(*)::FLOAT / NULLIF(COUNT(DISTINCT session_id), 0) * 100
      FROM cookie_consent_analytics
      WHERE consent_type = 'accepted_all' AND DATE(timestamp) = target_date
    ) as cookie_consent_rate,
    AVG(CASE WHEN uss.is_mobile THEN 1.0 ELSE 0.0 END) * 100 as mobile_visitors_percentage,
    85.0 as performance_score -- Base score, can be calculated based on metrics
  FROM user_session_summary uss
  WHERE DATE(uss.start_time) = target_date
  ON CONFLICT (date_period, period_type)
  DO UPDATE SET
    unique_visitors = EXCLUDED.unique_visitors,
    total_page_views = EXCLUDED.total_page_views,
    total_sessions = EXCLUDED.total_sessions,
    avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
    avg_pages_per_session = EXCLUDED.avg_pages_per_session,
    avg_load_time_ms = EXCLUDED.avg_load_time_ms,
    bounce_rate = EXCLUDED.bounce_rate,
    conversion_rate = EXCLUDED.conversion_rate,
    cookie_consent_rate = EXCLUDED.cookie_consent_rate,
    mobile_visitors_percentage = EXCLUDED.mobile_visitors_percentage,
    performance_score = EXCLUDED.performance_score,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for daily aggregates (with better error handling)
DO $$
BEGIN
    -- First check if the table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'performance_aggregates'
    ) THEN
        RAISE WARNING 'Table performance_aggregates does not exist, constraint cannot be added';
        RETURN;
    END IF;

    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'unique_daily_aggregate'
        AND table_name = 'performance_aggregates'
    ) THEN
        -- Try to add the constraint
        BEGIN
            ALTER TABLE performance_aggregates
            ADD CONSTRAINT unique_daily_aggregate
            UNIQUE (date_period, period_type);
            RAISE NOTICE 'Added unique_daily_aggregate constraint to performance_aggregates';
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE 'Constraint unique_daily_aggregate already exists (duplicate_object), skipping';
            WHEN others THEN
                RAISE WARNING 'Failed to add unique_daily_aggregate constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Constraint unique_daily_aggregate already exists, skipping';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in constraint creation block: %', SQLERRM;
END $$;
