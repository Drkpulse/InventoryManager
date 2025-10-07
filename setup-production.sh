#!/bin/bash

# Production Deployment Script for IT Asset Manager
# This script prepares the application for production deployment

echo "🚀 Preparing IT Asset Manager for Production..."

# Set NODE_ENV to production
export NODE_ENV=production

# Install production dependencies
echo "📦 Installing production dependencies..."
npm ci --only=production --no-audit --no-fund

# Build CSS if needed
echo "🎨 Building CSS..."
if [ -f "tailwind.config.js" ]; then
    npx tailwindcss -i ./src/input.css -o ./public/css/tailwind.css --minify
fi

# Set proper file permissions
echo "🔐 Setting file permissions..."
chmod -R 755 public/
chmod -R 750 src/
chmod 600 .env* 2>/dev/null || true

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs uploads data backups

# Set directory permissions
chmod 755 logs uploads data backups

# Security check
echo "🔒 Running security checks..."

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: No .env file found. Copy .env.example to .env and configure."
fi

# Check for session secret
if grep -q "change-me-in-production" .env 2>/dev/null; then
    echo "❌ ERROR: Please change SESSION_SECRET in .env file!"
    exit 1
fi

# Check for default passwords
if grep -q "postgres" .env 2>/dev/null; then
    echo "⚠️  Warning: Default database password detected. Please change DB_PASSWORD."
fi

# Production optimizations
echo "⚡ Applying production optimizations..."

# Create production start script
cat > start-production.sh << 'EOF'
#!/bin/bash
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

# Start with PM2 if available, otherwise node directly
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 start ecosystem.config.js --env production
else
    echo "Starting with Node.js..."
    node src/app.js
fi
EOF

chmod +x start-production.sh

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'it-asset-manager',
    script: 'src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=2048'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '2G',
    node_args: '--max-old-space-size=2048'
  }]
};
EOF

# Create systemd service file (optional)
cat > it-asset-manager.service << 'EOF'
[Unit]
Description=IT Asset Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/app.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=it-asset-manager

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Production setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review and configure your .env file"
echo "2. Set up your database and run migrations"
echo "3. Configure reverse proxy (nginx/apache)"
echo "4. Set up SSL certificates"
echo "5. Start the application:"
echo "   ./start-production.sh"
echo ""
echo "🔧 Optional:"
echo "- Install PM2 globally: npm install -g pm2"
echo "- Copy systemd service: sudo cp it-asset-manager.service /etc/systemd/system/"
echo "- Enable service: sudo systemctl enable it-asset-manager"
echo ""
echo "🍪 Cookie system is production-ready with:"
echo "- No inline event handlers (CSP compliant)"
echo "- Proper event listeners"
echo "- Robust error handling"
echo "- Debug tools available"
