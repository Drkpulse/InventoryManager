-- Enable pg_stat_statements extension for query performance monitoring
-- Migration: 008_enable_pg_stat_statements

-- Enable the pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant necessary permissions to view query statistics
-- Note: This extension requires PostgreSQL superuser privileges to install
-- If running in a managed environment, this might need to be done by the DBA

-- Create a view for easier access to query statistics (if extension is available)
CREATE OR REPLACE VIEW query_performance AS
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    min_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 100;

-- Note: If pg_stat_statements cannot be enabled due to permissions,
-- the performance monitoring will gracefully fallback to basic database stats
