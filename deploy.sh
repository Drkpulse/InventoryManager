#!/bin/bash

# IT Asset Manager - One-Click Deployment Script
echo "🚀 Starting IT Asset Manager deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${BLUE}✅ Docker and Docker Compose are installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file with your configuration before continuing.${NC}"
    echo -e "${YELLOW}   Especially change the SESSION_SECRET and database password!${NC}"
    read -p "Press Enter to continue after editing .env file..."
fi

# Stop any existing containers
echo -e "${BLUE}🛑 Stopping any existing containers...${NC}"
docker-compose down

# Build and start the application
echo -e "${BLUE}🏗️  Building and starting the application...${NC}"
docker-compose up --build -d

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 15

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ IT Asset Manager is running successfully!${NC}"
    echo -e "${GREEN}🌐 Access the application at: http://localhost:3000${NC}"
    echo -e "${GREEN}📊 Default admin credentials:${NC}"
    echo -e "   Username: admin@example.com"
    echo -e "   Password: admin"
    echo -e "${YELLOW}⚠️  Please change the default password after first login!${NC}"
    echo ""
    echo -e "${BLUE}📋 Useful commands:${NC}"
    echo -e "   View logs: ${YELLOW}docker-compose logs -f${NC}"
    echo -e "   Stop application: ${YELLOW}docker-compose down${NC}"
    echo -e "   Restart application: ${YELLOW}docker-compose restart${NC}"
    echo -e "   Update application: ${YELLOW}docker-compose down && docker-compose up --build -d${NC}"
else
    echo -e "${RED}❌ Failed to start the application. Check logs with: docker-compose logs${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"