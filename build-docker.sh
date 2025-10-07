#!/bin/bash

# IT Asset Manager - Docker Build Script
# This script builds the Docker image with proper tags and security practices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="drkpulse/it-asset-manager"
VERSION="2.0"
LATEST_TAG="latest"

echo -e "${BLUE}🐳 IT Asset Manager Docker Build Script${NC}"
echo "========================================"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running or not accessible${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Build the image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
echo "Image: ${IMAGE_NAME}"
echo "Version: ${VERSION}"

# Build with version tag
docker build \
    --tag "${IMAGE_NAME}:${VERSION}" \
    --tag "${IMAGE_NAME}:${LATEST_TAG}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Docker image built successfully${NC}"

# Show image information
echo -e "${BLUE}📋 Image Information:${NC}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Test the image (optional)
read -p "🧪 Would you like to run a quick test of the image? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧪 Running test container...${NC}"

    # Run test container with minimal required environment
    TEST_CONTAINER="test-it-asset-manager-$$"

    docker run -d \
        --name "${TEST_CONTAINER}" \
        --env DB_HOST=test-host \
        --env DB_PASSWORD=test-password \
        --env SESSION_SECRET=test-session-secret \
        --publish 3001:3000 \
        "${IMAGE_NAME}:${LATEST_TAG}" || {
        echo -e "${RED}❌ Test container failed to start${NC}"
        exit 1
    }

    # Wait a few seconds and check if container is running
    sleep 5

    if docker ps --filter "name=${TEST_CONTAINER}" --format "{{.Names}}" | grep -q "${TEST_CONTAINER}"; then
        echo -e "${GREEN}✅ Test container is running${NC}"
        echo "Container logs:"
        docker logs "${TEST_CONTAINER}" --tail 20

        # Cleanup
        echo -e "${YELLOW}🧹 Cleaning up test container...${NC}"
        docker stop "${TEST_CONTAINER}" >/dev/null 2>&1
        docker rm "${TEST_CONTAINER}" >/dev/null 2>&1
        echo -e "${GREEN}✅ Test completed and cleaned up${NC}"
    else
        echo -e "${RED}❌ Test container failed to start properly${NC}"
        echo "Container logs:"
        docker logs "${TEST_CONTAINER}"
        docker rm "${TEST_CONTAINER}" >/dev/null 2>&1
        exit 1
    fi
fi

# Push to registry (optional)
read -p "🚀 Would you like to push the image to Docker Hub? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚀 Pushing to Docker Hub...${NC}"

    # Check if logged in
    if ! docker info 2>/dev/null | grep -q "Username:"; then
        echo -e "${YELLOW}🔐 Please log in to Docker Hub:${NC}"
        docker login || {
            echo -e "${RED}❌ Docker login failed${NC}"
            exit 1
        }
    fi

    # Push both tags
    echo "Pushing ${IMAGE_NAME}:${VERSION}..."
    docker push "${IMAGE_NAME}:${VERSION}"

    echo "Pushing ${IMAGE_NAME}:${LATEST_TAG}..."
    docker push "${IMAGE_NAME}:${LATEST_TAG}"

    echo -e "${GREEN}✅ Image pushed successfully to Docker Hub${NC}"
    echo -e "${BLUE}📦 Image available at: https://hub.docker.com/r/${IMAGE_NAME}${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping Docker Hub push${NC}"
    echo "To push manually later, run:"
    echo "  docker push ${IMAGE_NAME}:${VERSION}"
    echo "  docker push ${IMAGE_NAME}:${LATEST_TAG}"
fi

echo
echo -e "${GREEN}🎉 Build process completed successfully!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Test the image thoroughly in your environment"
echo "2. Update your Unraid template if needed"
echo "3. Deploy to production"

# Show security scan reminder
echo
echo -e "${YELLOW}🔒 Security Reminder:${NC}"
echo "The image has been built without sensitive defaults in ENV variables."
echo "Always provide DB_PASSWORD and SESSION_SECRET at runtime!"
