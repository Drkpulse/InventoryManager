#!/bin/bash

# IT Asset Manager - Unraid Setup Helper Script
# This script helps you set up the container properly to avoid configuration loss

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🏢 IT Asset Manager - Unraid Setup Helper${NC}"
echo "=============================================="
echo

echo -e "${YELLOW}This script will help you set up IT Asset Manager correctly in Unraid${NC}"
echo -e "${YELLOW}to prevent configuration loss when editing the container.${NC}"
echo

# Step 1: Check PostgreSQL
echo -e "${BLUE}📋 Step 1: PostgreSQL Setup${NC}"
echo "=========================="

echo "1. First, install PostgreSQL from Community Applications if not already installed"
echo "2. Configure PostgreSQL with:"
echo "   - Database name: inventory_db"
echo "   - Username: postgres"
echo "   - Strong password (write it down!)"
echo

read -p "Press Enter when PostgreSQL is set up and running..."

# Step 2: Find PostgreSQL IP
echo
echo -e "${BLUE}🔍 Step 2: Find PostgreSQL IP Address${NC}"
echo "===================================="

echo "To find your PostgreSQL container IP:"
echo "1. Go to Unraid Docker tab"
echo "2. Find PostgreSQL container"
echo "3. Click container icon → Show more settings"
echo "4. Note the IP address in Network section"
echo
echo "Common PostgreSQL IPs: 172.17.0.2, 172.17.0.3, etc."
echo

read -p "Enter your PostgreSQL IP address: " POSTGRES_IP

if [ -z "$POSTGRES_IP" ]; then
    echo -e "${RED}❌ IP address is required${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL IP: $POSTGRES_IP${NC}"

# Test connection
echo
echo -e "${YELLOW}Testing connection to PostgreSQL...${NC}"
if nc -z "$POSTGRES_IP" 5432 2>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is reachable at $POSTGRES_IP:5432${NC}"
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL at $POSTGRES_IP:5432${NC}"
    echo -e "${YELLOW}   Check that PostgreSQL container is running${NC}"
    echo -e "${YELLOW}   Verify the IP address is correct${NC}"
    exit 1
fi

# Step 3: Get PostgreSQL password
echo
echo -e "${BLUE}🔒 Step 3: PostgreSQL Password${NC}"
echo "=============================="

read -sp "Enter your PostgreSQL password: " POSTGRES_PASSWORD
echo

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}❌ Password is required${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL password confirmed${NC}"

# Step 4: Generate session secret
echo
echo -e "${BLUE}🔐 Step 4: Generate Session Secret${NC}"
echo "=================================="

echo "Generating secure session secret..."
if command -v openssl >/dev/null 2>&1; then
    SESSION_SECRET=$(openssl rand -base64 64)
    echo -e "${GREEN}✅ Session secret generated${NC}"
else
    echo -e "${YELLOW}⚠️  OpenSSL not found, using fallback method${NC}"
    SESSION_SECRET="fallback-session-secret-$(date +%s)-$$"
fi

# Step 5: Container setup instructions
echo
echo -e "${BLUE}🐳 Step 5: Container Setup${NC}"
echo "=========================="

echo -e "${YELLOW}Now set up your IT Asset Manager container:${NC}"
echo
echo "1. Go to Unraid Docker tab"
echo "2. Click 'Add Container'"
echo "3. Select 'IT-Asset-Manager' template"
echo "4. Fill in these EXACT values:"
echo
echo -e "${CYAN}Required Configuration:${NC}"
echo "   🗄️  DB_HOST: $POSTGRES_IP"
echo "   🔒 DB_PASSWORD: [your PostgreSQL password]"
echo "   🔐 SESSION_SECRET: [generated secret - see below]"
echo
echo -e "${CYAN}Optional Configuration:${NC}"
echo "   🚀 INIT_DB: true (for first run only)"
echo "   🌍 TZ: $(timedatectl show --property=Timezone --value 2>/dev/null || echo 'America/New_York')"
echo

# Step 6: Configuration values
echo -e "${BLUE}📝 Step 6: Copy These Values${NC}"
echo "============================"

echo
echo -e "${GREEN}🗄️  DB_HOST (copy this exactly):${NC}"
echo "$POSTGRES_IP"
echo

echo -e "${GREEN}🔒 DB_PASSWORD (copy your PostgreSQL password):${NC}"
echo "[Use the password you set for PostgreSQL]"
echo

echo -e "${GREEN}🔐 SESSION_SECRET (copy this exactly):${NC}"
echo "$SESSION_SECRET"
echo

# Step 7: Volume mappings
echo -e "${BLUE}💾 Step 7: Verify Volume Mappings${NC}"
echo "================================="

echo -e "${YELLOW}Make sure these volumes are mapped:${NC}"
echo "   /config → /mnt/user/appdata/it-asset-manager/config"
echo "   /app/uploads → /mnt/user/appdata/it-asset-manager/uploads"
echo "   /app/logs → /mnt/user/appdata/it-asset-manager/logs"
echo "   /app/data → /mnt/user/appdata/it-asset-manager/data"
echo

# Step 8: Final checklist
echo -e "${BLUE}✅ Step 8: Final Checklist${NC}"
echo "========================="

echo "Before clicking Apply, verify:"
echo "   ✅ PostgreSQL container is running"
echo "   ✅ DB_HOST is set to: $POSTGRES_IP"
echo "   ✅ DB_PASSWORD matches PostgreSQL password"
echo "   ✅ SESSION_SECRET is set (not empty)"
echo "   ✅ Volume mappings are configured"
echo "   ✅ INIT_DB is set to 'true' for first run"
echo

# Step 9: Post-setup
echo -e "${BLUE}🎉 Step 9: After Setup${NC}"
echo "====================="

echo "After clicking Apply:"
echo "1. Wait 2-3 minutes for initialization"
echo "2. Check container logs for errors"
echo "3. Access web interface: http://$(hostname -I | awk '{print $1}'):3000"
echo "4. Login with: admin@example.com / admin"
echo "5. CHANGE THE ADMIN PASSWORD IMMEDIATELY!"
echo
echo "If you need to edit the container later:"
echo "- Your configuration will now persist!"
echo "- Just go to Docker → IT-Asset-Manager → Edit"
echo "- Your values will be saved"
echo

# Save configuration for reference
CONFIG_FILE="/tmp/it-asset-manager-config.txt"
cat > "$CONFIG_FILE" << EOF
IT Asset Manager Configuration
=============================
Generated: $(date)

Database Configuration:
  DB_HOST: $POSTGRES_IP
  DB_PASSWORD: [your PostgreSQL password]
  SESSION_SECRET: $SESSION_SECRET

Access Information:
  Web Interface: http://$(hostname -I | awk '{print $1}'):3000
  Default Login: admin@example.com / admin

Volume Locations:
  Config: /mnt/user/appdata/it-asset-manager/config
  Uploads: /mnt/user/appdata/it-asset-manager/uploads
  Logs: /mnt/user/appdata/it-asset-manager/logs
  Data: /mnt/user/appdata/it-asset-manager/data

Notes:
- Change admin password after first login
- Set INIT_DB=false after successful first run
- Your configuration will persist when editing container
EOF

echo -e "${GREEN}✅ Configuration saved to: $CONFIG_FILE${NC}"
echo -e "${YELLOW}💡 Keep this file as reference for your setup${NC}"

echo
echo -e "${BLUE}🚀 Ready to proceed!${NC}"
echo "==================="
echo "You now have all the information needed to set up IT Asset Manager"
echo "without losing configuration when editing the container."
echo
echo -e "${GREEN}Good luck! 🎉${NC}"
