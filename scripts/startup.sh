#!/bin/bash

# Application startup script with automatic database migrations
# This script runs before the main application starts

set -e

echo "🚀 Starting IT Asset Manager..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database connection...${NC}"
until node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
pool.query('SELECT 1').then(() => {
  console.log('Database connected');
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
" 2>/dev/null; do
  echo "Waiting for database..."
  sleep 2
done

echo -e "${GREEN}✅ Database connection established${NC}"

# Run database initialization and migrations
echo -e "${BLUE}🔄 Running database initialization and migrations...${NC}"
if node database/init-db.js; then
  echo -e "${GREEN}✅ Database setup completed${NC}"
else
  echo -e "${RED}❌ Database setup failed${NC}"
  exit 1
fi

# Start the main application
echo -e "${BLUE}🎯 Starting the main application...${NC}"
exec "$@"
