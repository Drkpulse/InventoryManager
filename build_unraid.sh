#!/bin/bash
# filepath: /home/drkpulse/Documents/Github/inv_manager/build_and_deploy.sh
set -e

echo "🐳 Building IT Asset Manager for Docker Hub..."

# Configuration
DOCKER_USERNAME="d4rkpulse"
IMAGE_NAME="it-asset-manager"
REPO_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Clean up old builds
echo "🧹 Cleaning up old builds..."
docker system prune -f

# Remove old package-lock and regenerate
rm -f package-lock.json
npm install --package-lock-only

echo "🔨 Building Docker image..."
docker build --no-cache \
    --tag "${REPO_NAME}:test"
    .

echo "✅ Build completed successfully!"

# Show image info
echo "📊 Image details:"
docker images "${REPO_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Test the image
echo "🧪 Testing image..."
if docker run --rm "${REPO_NAME}:latest" node --version; then
    echo "✅ Image test passed!"
else
    echo "❌ Image test failed!"
    exit 1
fi

# Login check
echo "🔐 Checking Docker Hub authentication..."
if ! docker info | grep -q "Username: ${DOCKER_USERNAME}"; then
    echo "Please login to Docker Hub:"
    docker login
fi

# Push images
echo "📤 Pushing images to Docker Hub..."
docker push "${REPO_NAME}:test"

echo "✅ Successfully pushed to Docker Hub!"
echo ""
echo "🎉 Images available at:"
echo "   - ${REPO_NAME}:test"
echo ""
echo "📋 Ready for Unraid deployment!"
