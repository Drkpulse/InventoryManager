#!/bin/bash

echo "🚀 Starting Inventory Manager Fix Process..."

# Run tests first
echo "🧪 Running fix verification tests..."
node test-fixes.js

echo ""

# Check if PostgreSQL is running
if ! pgrep -x "postgres" > /dev/null; then
    echo "📋 PostgreSQL is not running. Attempting to start..."
    
    # Try to start PostgreSQL using common methods
    if command -v service > /dev/null; then
        sudo service postgresql start
    elif command -v systemctl > /dev/null; then
        sudo systemctl start postgresql
    elif command -v brew > /dev/null; then
        brew services start postgresql
    else
        echo "❌ Could not start PostgreSQL automatically. Please start it manually."
        echo "Common commands:"
        echo "  - sudo service postgresql start"
        echo "  - sudo systemctl start postgresql"
        echo "  - brew services start postgresql (macOS)"
        exit 1
    fi
    
    # Wait a moment for PostgreSQL to start
    sleep 3
fi

echo "🔧 Applying database fixes..."

# Apply the database fixes
if command -v psql > /dev/null; then
    echo "Running database migration..."
    psql -h localhost -U postgres -d inventory_db -f database/add-missing-columns.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Database fixes applied successfully!"
    else
        echo "❌ Failed to apply database fixes. You may need to:"
        echo "1. Ensure PostgreSQL is running"
        echo "2. Check database connection settings"
        echo "3. Manually run: psql -h localhost -U postgres -d inventory_db -f database/add-missing-columns.sql"
    fi
else
    echo "⚠️  psql not found. Please manually apply database/add-missing-columns.sql"
fi

echo "🚀 Starting the application..."
npm start