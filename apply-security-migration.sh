#!/bin/bash

# Apply security schema verification migration
# This script applies the 012_verify_security_schema.sql migration

set -e

echo "🔧 Applying security schema verification migration..."

# Check if Docker Compose is available and database is running
if ! docker-compose exec database psql --version > /dev/null 2>&1; then
    echo "❌ Database container is not running. Please start it first with:"
    echo "   docker-compose up database"
    exit 1
fi

# Apply the migration
echo "📋 Applying migration: 012_verify_security_schema.sql"
if docker-compose exec -T database psql -U postgres -d inventory_db < database/migrations/012_verify_security_schema.sql; then
    echo "✅ Security schema migration applied successfully!"

    # Verify tables exist
    echo "🔍 Verifying security tables..."
    docker-compose exec database psql -U postgres -d inventory_db -c "
    SELECT
        schemaname,
        tablename
    FROM pg_tables
    WHERE tablename IN (
        'login_attempts', 'account_lockouts', 'security_events',
        'password_history', 'user_sessions', 'csrf_tokens',
        'api_tokens', 'user_2fa'
    )
    ORDER BY tablename;"

    # Verify user table columns
    echo "🔍 Verifying user table columns..."
    docker-compose exec database psql -U postgres -d inventory_db -c "
    SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name IN (
        'failed_login_attempts', 'account_locked',
        'locked_at', 'locked_until', 'login_attempts'
    )
    ORDER BY column_name;"

    echo "🎉 Migration verification complete!"

else
    echo "❌ Migration failed!"
    exit 1
fi
