#!/bin/bash

# IT Asset Manager - Release Management Script
# This script handles versioning and release management for Docker images and Unraid templates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
IMAGE_NAME="drkpulse/it-asset-manager"
TEMPLATE_FILE="it-inv-template.xml"

# Get current version from git tag or ask user
get_version() {
    # Try to get version from git tag
    if git describe --tags --exact-match 2>/dev/null; then
        VERSION=$(git describe --tags --exact-match)
        echo -e "${GREEN}Using git tag version: $VERSION${NC}"
    else
        echo -e "${YELLOW}No git tag found for current commit${NC}"
        read -p "Enter version (e.g., v2.1, v2.0.1): " VERSION

        if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
            echo -e "${RED}❌ Invalid version format. Use v2.0, v2.1, v2.0.1, etc.${NC}"
            exit 1
        fi
    fi

    VERSION_NUMBER=${VERSION#v}  # Remove 'v' prefix for some uses
}

# Update template with new version
update_template() {
    local new_version=$1
    local template_backup="${TEMPLATE_FILE}.backup-$(date +%Y%m%d_%H%M%S)"

    echo -e "${YELLOW}📝 Updating Unraid template...${NC}"

    # Backup original template
    cp "$TEMPLATE_FILE" "$template_backup"
    echo -e "${GREEN}✅ Template backed up to: $template_backup${NC}"

    # Update version in Changes section
    sed -i "s/### Version [0-9]\+\.[0-9]\+\(\.[0-9]\+\)\?/### Version $VERSION_NUMBER/" "$TEMPLATE_FILE"

    # Update DateInstalled to current epoch time
    current_epoch=$(date +%s)
    sed -i "s/<DateInstalled>[0-9]\+<\/DateInstalled>/<DateInstalled>$current_epoch<\/DateInstalled>/" "$TEMPLATE_FILE"

    echo -e "${GREEN}✅ Template updated with version $VERSION_NUMBER${NC}"
}

# Build and tag images
build_and_tag() {
    local version=$1

    echo -e "${YELLOW}🔨 Building Docker image with version tags...${NC}"

    # Build with multiple tags
    docker build \
        --tag "${IMAGE_NAME}:${version}" \
        --tag "${IMAGE_NAME}:latest" \
        --label "org.opencontainers.image.version=${version}" \
        --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --label "org.opencontainers.image.revision=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        . || {
        echo -e "${RED}❌ Docker build failed${NC}"
        exit 1
    }

    echo -e "${GREEN}✅ Built images:${NC}"
    echo "  - ${IMAGE_NAME}:${version}"
    echo "  - ${IMAGE_NAME}:latest"
}

# Push images to registry
push_images() {
    local version=$1

    echo -e "${YELLOW}🚀 Pushing images to Docker Hub...${NC}"

    # Push version tag
    echo "Pushing ${IMAGE_NAME}:${version}..."
    docker push "${IMAGE_NAME}:${version}"

    # Push latest tag
    echo "Pushing ${IMAGE_NAME}:latest..."
    docker push "${IMAGE_NAME}:latest"

    echo -e "${GREEN}✅ Images pushed successfully${NC}"
}

# Create git tag and commit
tag_release() {
    local version=$1

    echo -e "${YELLOW}🏷️  Creating git tag and commit...${NC}"

    # Add template changes
    git add "$TEMPLATE_FILE"

    # Commit with version message
    git commit -m "Release $version - Updated template and container" || echo "No changes to commit"

    # Create and push tag
    git tag -a "$version" -m "Release $version"
    git push origin "$version"
    git push origin "$(git branch --show-current)"

    echo -e "${GREEN}✅ Git tag $version created and pushed${NC}"
}

# Main release process
main() {
    echo -e "${BLUE}🚀 IT Asset Manager Release Management${NC}"
    echo "========================================"

    # Get version
    get_version

    echo -e "${YELLOW}📋 Release Summary:${NC}"
    echo "  Version: $VERSION"
    echo "  Image: ${IMAGE_NAME}:${VERSION}"
    echo "  Template: $TEMPLATE_FILE"
    echo

    read -p "Continue with release? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Release cancelled"
        exit 0
    fi

    # Execute release steps
    echo -e "${YELLOW}🔄 Starting release process...${NC}"

    # Step 1: Update template
    update_template "$VERSION_NUMBER"

    # Step 2: Build images
    build_and_tag "$VERSION"

    # Step 3: Test the image
    echo -e "${YELLOW}🧪 Testing new image...${NC}"
    TEST_CONTAINER="test-release-$$"

    if docker run -d --name "$TEST_CONTAINER" \
        --env DB_HOST=test --env DB_PASSWORD=test --env SESSION_SECRET=test \
        "${IMAGE_NAME}:${VERSION}" >/dev/null 2>&1; then

        sleep 5
        if docker ps --filter "name=$TEST_CONTAINER" --format "{{.Names}}" | grep -q "$TEST_CONTAINER"; then
            echo -e "${GREEN}✅ Image test passed${NC}"
            docker stop "$TEST_CONTAINER" >/dev/null 2>&1
            docker rm "$TEST_CONTAINER" >/dev/null 2>&1
        else
            echo -e "${RED}❌ Image test failed - container not running${NC}"
            docker logs "$TEST_CONTAINER" || true
            docker rm "$TEST_CONTAINER" >/dev/null 2>&1
            exit 1
        fi
    else
        echo -e "${RED}❌ Image test failed - could not start container${NC}"
        exit 1
    fi

    # Step 4: Push to registry
    push_images "$VERSION"

    # Step 5: Git operations
    tag_release "$VERSION"

    echo
    echo -e "${GREEN}🎉 Release $VERSION completed successfully!${NC}"
    echo
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Check Docker Hub: https://hub.docker.com/r/${IMAGE_NAME}/tags"
    echo "2. Submit template to Unraid Community Applications"
    echo "3. Update documentation with new version"
    echo "4. Monitor for user feedback"
    echo
    echo -e "${YELLOW}📊 How Unraid will detect updates:${NC}"
    echo "- Users with ':latest' will get automatic updates"
    echo "- Users with specific versions can manually update"
    echo "- Template updates require Community Apps repo refresh"
}

# Run main function
main "$@"
