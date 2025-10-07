#!/bin/bash

# Database Migration Runner
# This script runs the pending migrations

echo "🔄 Running database migrations..."

# Database connection info
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-inventory_db}
DB_USER=${DB_USER:-postgres}

# Check if .env file exists and source it
if [ -f .env ]; then
    echo "📋 Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Function to run a migration
run_migration() {
    local migration_file=$1
    echo "🔄 Running migration: $(basename "$migration_file")"

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"; then
        echo "✅ Migration completed: $(basename "$migration_file")"
    else
        echo "❌ Migration failed: $(basename "$migration_file")"
        return 1
    fi
}

# Run specific migrations
echo "🔄 Running pg_stat_statements migration..."
run_migration "database/migrations/008_enable_pg_stat_statements.sql"

echo "🔄 Running notifications removal migration..."
run_migration "database/migrations/009_remove_notifications.sql"

echo "✅ All migrations completed!"
