#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 IT Asset Manager - PM2 Deployment${NC}"
echo "=================================================="

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Load environment variables
if [ -f .env ]; then
    echo -e "${GREEN}✅ Loading environment variables${NC}"
    export $(cat .env | grep -v '#' | xargs)
else
    echo -e "${YELLOW}⚠️  .env file not found, using defaults${NC}"
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Setup database and start application
echo -e "${BLUE}🗄️ Setting up database and starting application...${NC}"
node scripts/setup-with-pm2.js

# Save PM2 configuration for auto-restart on reboot
echo -e "${BLUE}💾 Saving PM2 configuration...${NC}"
pm2 save

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}🌐 Application is running at: http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}📋 Useful PM2 commands:${NC}"
echo -e "   Monitor: ${YELLOW}pm2 monit${NC}"
echo -e "   Logs: ${YELLOW}pm2 logs it-asset-manager${NC}"
echo -e "   Restart: ${YELLOW}pm2 restart it-asset-manager${NC}"
echo -e "   Stop: ${YELLOW}pm2 stop it-asset-manager${NC}"
echo -e "   Status: ${YELLOW}pm2 status${NC}"
