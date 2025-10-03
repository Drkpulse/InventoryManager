#!/bin/bash

# Database Migration Runner
# This script automatically runs pending migrations when Docker containers start

set -e

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-inventory_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Starting database migration check...${NC}"

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo -e "${GREEN}✅ Database is ready${NC}"

# Create migrations table if it doesn't exist
echo -e "${YELLOW}📋 Checking migrations table...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
CREATE TABLE IF NOT EXISTS database_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);
EOF

# Function to get file checksum
get_checksum() {
    sha256sum "$1" | cut -d' ' -f1
}

# Function to check if migration was already applied
is_applied() {
    local filename="$1"
    local count
    count=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM database_migrations WHERE filename = '$filename';" | tr -d ' ')
    [ "$count" -gt 0 ]
}

# Function to apply migration
apply_migration() {
    local filepath="$1"
    local filename
    filename=$(basename "$filepath")
    local checksum
    checksum=$(get_checksum "$filepath")

    echo -e "${YELLOW}🔄 Applying migration: $filename${NC}"

    # Apply the migration
    if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$filepath"; then
        # Record successful migration
        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO database_migrations (filename, checksum) VALUES ('$filename', '$checksum');"
        echo -e "${GREEN}✅ Successfully applied migration: $filename${NC}"
    else
        echo -e "${RED}❌ Failed to apply migration: $filename${NC}"
        exit 1
    fi
}

# Run migrations
MIGRATION_DIR="/docker-entrypoint-initdb.d/migrations"

if [ -d "$MIGRATION_DIR" ]; then
    echo -e "${YELLOW}📁 Looking for migrations in $MIGRATION_DIR${NC}"

    # Process migrations in alphabetical order
    for migration_file in "$MIGRATION_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            filename=$(basename "$migration_file")

            if is_applied "$filename"; then
                echo -e "${GREEN}⏭️  Migration already applied: $filename${NC}"
            else
                apply_migration "$migration_file"
            fi
        fi
    done
else
    echo -e "${YELLOW}📁 Migration directory not found: $MIGRATION_DIR${NC}"
fi

echo -e "${GREEN}🎉 Database migration check completed${NC}"
