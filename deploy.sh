#!/bin/bash

# IT Asset Manager - Production Deployment Script
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
BACKUP_DIR="backups"
LOG_FILE="deploy.log"

# Functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

error_exit() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING: $1"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

# Add these helper functions at the top of the script
check_url_health() {
    local url="$1"
    local timeout="${2:-10}"
    curl -f -s -m "$timeout" --connect-timeout 5 "$url" >/dev/null 2>&1
}

check_service_health() {
    local service="$1"
    case "$service" in
        "postgres")
            $DOCKER_COMPOSE exec -T postgres pg_isready -U postgres -d inventory_db >/dev/null 2>&1
            ;;
        "redis")
            $DOCKER_COMPOSE exec -T redis redis-cli ping >/dev/null 2>&1
            ;;
        "app")
            check_url_health "http://localhost:3000/health"
            ;;
        "nginx")
            check_url_health "http://localhost:80/health"
            ;;
        *)
            return 1
            ;;
    esac
}

debug_services() {
    info "=== SERVICE DEBUG INFORMATION ==="

    echo "Docker Compose PS Output:"
    $DOCKER_COMPOSE ps

    echo -e "\nContainer Health Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "label=com.docker.compose.project"

    echo -e "\nRecent logs from all services:"
    $DOCKER_COMPOSE logs --tail=10 --timestamps

    echo -e "\nNetwork connectivity:"
    docker network ls | grep "$(basename "$(pwd)")"

    echo "=== END DEBUG INFORMATION ==="
}

# Check Node.js version
check_node_version() {
    info "Checking Node.js version..."

    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed. Please install Node.js 18.x or higher."
    fi

    local node_version=$(node --version | sed 's/v//')
    local required_major=18
    local current_major=$(echo "$node_version" | cut -d. -f1)

    if [[ $current_major -lt $required_major ]]; then
        error_exit "Node.js version $node_version is too old. Required: $required_major.x or higher. Consider using nvm to update."
    fi

    success "Node.js version $node_version is compatible"
}

# Function to safely load environment variables
load_env_vars() {
    if [[ -f "$ENV_FILE" ]]; then
        # Use a more robust method to load environment variables
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

            # Check if line contains an assignment
            if [[ "$line" =~ ^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$ ]]; then
                var_name="${BASH_REMATCH[1]}"
                var_value="${BASH_REMATCH[2]}"

                # Remove quotes if present
                var_value="${var_value%\"}"
                var_value="${var_value#\"}"
                var_value="${var_value%\'}"
                var_value="${var_value#\'}"

                # Export the variable
                export "$var_name=$var_value"
                info "Loaded environment variable: $var_name"
            fi
        done < "$ENV_FILE"
    else
        warning "Environment file $ENV_FILE not found"
    fi
}

# Pre-flight checks
preflight_checks() {
    info "Starting pre-flight checks..."

    # Check Node.js version first
    check_node_version

    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error_exit "This script should not be run as root for security reasons"
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not installed. Please install Docker Compose first."
    fi

    # Support both docker-compose and docker compose commands
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running or you don't have permission to access it"
    fi

    # Check disk space (require at least 2GB free)
    available_space=$(df . | awk 'NR==2 {print $4}')
    required_space=2097152  # 2GB in KB
    if [[ $available_space -lt $required_space ]]; then
        error_exit "Insufficient disk space. At least 2GB free space required."
    fi

    success "Pre-flight checks passed"
}

# Check and fix npm dependencies
check_dependencies() {
    info "Checking npm dependencies..."

    if [[ -f "package.json" ]]; then
        # Check if node_modules exists and is up to date
        if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
            info "Installing/updating npm dependencies..."

            # Clean install for consistency
            rm -rf node_modules package-lock.json

            # Try normal install first
            if ! npm install 2>/dev/null; then
                warning "Normal npm install failed, trying with --legacy-peer-deps..."
                if ! npm install --legacy-peer-deps; then
                    warning "Legacy peer deps install failed, trying with --force..."
                    npm install --force
                fi
            fi
        fi

        success "Dependencies are up to date"
    fi
}

# Environment setup
setup_environment() {
    info "Setting up environment..."

    # Create necessary directories
    mkdir -p "$BACKUP_DIR" logs ssl data

    # Check if .env exists
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example "$ENV_FILE"
            warning "Created $ENV_FILE from .env.example"
            warning "Please edit $ENV_FILE with your production values before continuing!"

            # Generate secure session secret
            if command -v openssl &> /dev/null; then
                session_secret=$(openssl rand -base64 64 | tr -d '\n')
                sed -i.bak "s/your-super-secret-session-key-change-in-production/$session_secret/" "$ENV_FILE"
                info "Generated secure session secret"
            fi

            echo -e "${YELLOW}Please edit the following critical settings in $ENV_FILE:${NC}"
            echo "- DB_PASSWORD (change from default)"
            echo "- SESSION_SECRET (already generated)"
            echo "- EMAIL_* settings (if using notifications)"

            read -p "Press Enter after editing $ENV_FILE to continue..."
        else
            error_exit "$ENV_FILE not found and no .env.example template available"
        fi
    fi

    # Load environment variables safely
    load_env_vars

    # Validate critical environment variables
    if [[ "${DB_PASSWORD:-}" == "postgres" ]] || [[ "${DB_PASSWORD:-}" == "postgres123" ]]; then
        error_exit "DB_PASSWORD is still set to default value. Please change it in $ENV_FILE"
    fi

    if [[ "${SESSION_SECRET:-}" == *"change-in-production"* ]]; then
        error_exit "SESSION_SECRET is still set to default value. Please change it in $ENV_FILE"
    fi

    success "Environment setup completed"
}

# Package version check
check_package_versions() {
    info "Checking package versions..."

    if [[ -f "package.json" ]] && command -v npm &> /dev/null; then
        # Check for outdated packages
        if npm outdated --json > /dev/null 2>&1; then
            info "All packages are up to date"
        else
            warning "Some packages have updates available"
            warning "Run 'npm run update-deps:safe' to update non-breaking changes"
        fi

        # Check for security vulnerabilities
        if npm audit --audit-level moderate --json > /dev/null 2>&1; then
            success "No moderate+ security vulnerabilities found"
        else
            warning "Security vulnerabilities detected. Review with 'npm audit'"
        fi
    fi
}

# Security checks
security_checks() {
    info "Running security checks..."

    # Check file permissions
    chmod 600 "$ENV_FILE" 2>/dev/null || true

    # Check for SSL certificates in production
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        if [[ ! -f "ssl/cert.pem" ]] || [[ ! -f "ssl/key.pem" ]]; then
            warning "SSL certificates not found in ssl/ directory"
            warning "HTTPS will not work without proper SSL certificates"

            # Generate self-signed certificates for testing
            if command -v openssl &> /dev/null; then
                info "Generating self-signed SSL certificates for testing..."
                openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
                    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null
                warning "Self-signed certificates generated. Replace with proper certificates for production!"
            fi
        fi
    fi

    # Run npm audit
    if [[ -f "package.json" ]]; then
        info "Running security audit..."
        if npm audit --audit-level high 2>/dev/null; then
            success "No high-severity vulnerabilities found"
        else
            warning "Security vulnerabilities detected. Run 'npm audit fix' to resolve."
        fi
    fi

    success "Security checks completed"
}

# Docker optimization check
check_docker_optimization() {
    info "Checking Docker optimization..."

    # Check if multi-stage build is being used
    if grep -q "FROM.*AS.*" Dockerfile 2>/dev/null; then
        success "Multi-stage Docker build detected"
    else
        warning "Consider using multi-stage Docker build for optimization"
    fi

    # Check .dockerignore
    if [[ -f ".dockerignore" ]]; then
        success ".dockerignore file found"
    else
        warning "Consider adding .dockerignore for better build performance"
    fi

    # Check image size after build
    if docker images it-asset-manager:latest &>/dev/null; then
        local image_size=$(docker images it-asset-manager:latest --format "{{.Size}}")
        info "Docker image size: $image_size"
    fi
}

# Backup existing data
backup_data() {
    info "Creating backup of existing data..."

    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="$BACKUP_DIR/backup_$timestamp.tar.gz"

    # Check if containers are running
    if $DOCKER_COMPOSE ps -q 2>/dev/null | grep -q .; then
        info "Creating database backup..."

        # Create database backup
        if $DOCKER_COMPOSE exec -T postgres pg_dump -U postgres inventory_db > "$BACKUP_DIR/db_backup_$timestamp.sql" 2>/dev/null; then
            success "Database backup created: db_backup_$timestamp.sql"
        else
            warning "Failed to create database backup"
        fi

        # Backup uploads directory
        if [[ -d "uploads" ]]; then
            tar -czf "$backup_file" uploads/ 2>/dev/null || true
            success "File backup created: $backup_file"
        fi
    else
        info "No running containers found, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    info "Deploying application..."

    # Stop existing containers
    info "Stopping existing containers..."
    $DOCKER_COMPOSE down --remove-orphans || true

    # Clean up unused Docker resources
    info "Cleaning up Docker resources..."
    docker system prune -f --volumes || true

    # Build and start services
    info "Building and starting services..."
    $DOCKER_COMPOSE up --build -d

    # Wait for all services to be healthy
    wait_for_services

    success "Application deployed successfully"
}

# New comprehensive health check function
wait_for_services() {
    info "Waiting for all services to become healthy..."

    local max_attempts=120  # 10 minutes total
    local attempt=0
    local check_interval=5

    # Define health check endpoints
    local app_health_url="http://localhost:3000/health"
    local nginx_health_url="http://localhost:80/health"

    while [[ $attempt -lt $max_attempts ]]; do
        local all_healthy=true
        local services_status=""

        # Check Docker Compose service health
        local compose_status=$($DOCKER_COMPOSE ps --format json 2>/dev/null || echo "[]")

        # Check individual services
        echo -n "Checking services [$(($attempt * $check_interval))s]: "

        # 1. Check PostgreSQL
        if $DOCKER_COMPOSE exec -T postgres pg_isready -U postgres -d inventory_db >/dev/null 2>&1; then
            echo -n "✅ DB "
            services_status+="DB:OK "
        else
            echo -n "❌ DB "
            services_status+="DB:FAIL "
            all_healthy=false
        fi

        # 2. Check Redis
        if $DOCKER_COMPOSE exec -T redis redis-cli ping >/dev/null 2>&1; then
            echo -n "✅ Redis "
            services_status+="Redis:OK "
        else
            echo -n "❌ Redis "
            services_status+="Redis:FAIL "
            all_healthy=false
        fi

        # 3. Check Application
        if curl -f -s -m 10 "$app_health_url" >/dev/null 2>&1; then
            echo -n "✅ App "
            services_status+="App:OK "
        else
            echo -n "❌ App "
            services_status+="App:FAIL "
            all_healthy=false
        fi

        # 4. Check Nginx (if port 80 is mapped)
        if netstat -tuln 2>/dev/null | grep -q ":80 " || ss -tuln 2>/dev/null | grep -q ":80 "; then
            if curl -f -s -m 10 "$nginx_health_url" >/dev/null 2>&1; then
                echo -n "✅ Nginx "
                services_status+="Nginx:OK "
            else
                echo -n "❌ Nginx "
                services_status+="Nginx:FAIL "
                all_healthy=false
            fi
        else
            echo -n "⚠️ Nginx "
            services_status+="Nginx:SKIP "
        fi

        echo "" # New line

        # If all services are healthy, break
        if [[ $all_healthy == true ]]; then
            success "All services are healthy!"

            # Additional health verification
            local health_response=$(curl -s "$app_health_url" 2>/dev/null || echo "{}")
            if echo "$health_response" | grep -q '"status":"healthy"'; then
                info "Application health check passed"
                break
            else
                warning "Application responded but health status unclear"
            fi
        fi

        # Check for failed containers
        local failed_containers=$($DOCKER_COMPOSE ps --filter "status=exited" -q | wc -l)
        if [[ $failed_containers -gt 0 ]]; then
            error_exit "Some containers have exited. Check logs: $DOCKER_COMPOSE logs"
        fi

        attempt=$((attempt + 1))

        # Show progress every 30 seconds
        if [[ $((attempt % 6)) -eq 0 ]]; then
            info "Still waiting... (${attempt}/${max_attempts}) - Status: $services_status"

            # Show container status
            info "Container status:"
            $DOCKER_COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
        fi

        sleep $check_interval
    done

    if [[ $attempt -ge $max_attempts ]]; then
        error_exit "Services failed to start within $(($max_attempts * $check_interval)) seconds. Check logs: $DOCKER_COMPOSE logs"
    fi
}

# Enhanced post-deployment checks
post_deployment_checks() {
    info "Running comprehensive post-deployment checks..."

    # 1. Application Health Check
    info "Checking application health endpoint..."
    local health_response=$(curl -s -m 10 http://localhost:3000/health 2>/dev/null || echo "{}")

    if echo "$health_response" | grep -q '"status":"healthy"'; then
        success "Application health check passed"

        # Parse health response for detailed status
        if command -v jq >/dev/null 2>&1; then
            echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
        else
            echo "Health Response: $health_response"
        fi
    else
        warning "Application health check unclear. Response: $health_response"
    fi

    # 2. Database Connection Test
    info "Testing database connection..."
    if $DOCKER_COMPOSE exec -T postgres psql -U postgres -d inventory_db -c "SELECT 1;" >/dev/null 2>&1; then
        success "Database connection test passed"
    else
        error_exit "Database connection test failed"
    fi

    # 3. Redis Connection Test
    info "Testing Redis connection..."
    if $DOCKER_COMPOSE exec -T redis redis-cli ping | grep -q "PONG"; then
        success "Redis connection test passed"
    else
        error_exit "Redis connection test failed"
    fi

    # 4. Check container resource usage
    info "Checking container resource usage..."
    $DOCKER_COMPOSE top

    # 5. Check container logs for errors
    info "Checking for critical errors in logs..."
    local error_count=$($DOCKER_COMPOSE logs --tail=50 2>/dev/null | grep -i -c "error\|fatal\|exception" || echo "0")
    if [[ $error_count -gt 0 ]]; then
        warning "Found $error_count potential errors in logs. Review with: $DOCKER_COMPOSE logs"
    else
        success "No critical errors found in recent logs"
    fi

    # 6. Port accessibility check
    info "Checking port accessibility..."
    local ports_to_check=(3000 80)
    for port in "${ports_to_check[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
            success "Port $port is accessible"
        else
            warning "Port $port may not be accessible"
        fi
    done

    # 7. SSL Certificate check (if applicable)
    if [[ -f "ssl/cert.pem" ]]; then
        info "Checking SSL certificate..."
        local cert_expiry=$(openssl x509 -in ssl/cert.pem -noout -enddate 2>/dev/null | cut -d= -f2)
        if [[ -n "$cert_expiry" ]]; then
            info "SSL certificate expires: $cert_expiry"
        fi
    fi

    # 8. Disk space check
    local disk_usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        warning "Disk usage is above 90% ($disk_usage%). Consider cleaning up."
    else
        success "Disk usage is acceptable ($disk_usage%)"
    fi

    # 9. Memory usage check
    local memory_info=$(free -h | grep "Mem:")
    info "Memory usage: $memory_info"

    # 10. Final container status
    info "Final container status:"
    $DOCKER_COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}\t{{.Ports}}"

    success "All post-deployment checks completed"
}

# Cleanup old backups
cleanup_backups() {
    info "Cleaning up old backups..."

    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

    success "Old backups cleaned up"
}

# Add this function before deploy_application()
prepare_build_environment() {
    info "Preparing build environment..."

    # Create necessary directories
    mkdir -p public/css logs uploads data

    # Check if input.css exists
    if [[ ! -f "src/input.css" ]]; then
        info "Creating src/input.css..."
        cat > src/input.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
    fi

    # Verify TailwindCSS config
    if [[ ! -f "tailwind.config.js" ]]; then
        warning "tailwind.config.js not found. Build may fail."
    fi

    success "Build environment prepared"
}


# Main deployment process
main() {
    echo -e "${BLUE}"
    echo "🚀 IT Asset Manager - Production Deployment"
    echo "=============================================="
    echo -e "${NC}"

    log "Starting production deployment..."

    preflight_checks
    check_dependencies
    setup_environment
	prepare_build_environment
    check_package_versions
    security_checks
    check_docker_optimization
    backup_data
    deploy_application
    post_deployment_checks
    cleanup_backups

    echo -e "${GREEN}"
    echo "🎉 Deployment completed successfully!"
    echo "======================================"
    echo -e "${NC}"
    echo -e "${GREEN}🌐 Application URL: http://localhost:3000${NC}"
    echo -e "${GREEN}🔒 HTTPS URL: https://localhost:3000${NC}"
    echo -e "${GREEN}📊 Default admin credentials:${NC}"
    echo "   Username: admin@example.com"
    echo "   Password: admin"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Change the default admin password immediately!${NC}"
    echo ""
    echo -e "${BLUE}📋 Useful commands:${NC}"
    echo -e "   View logs: ${YELLOW}$DOCKER_COMPOSE logs -f${NC}"
    echo -e "   Stop application: ${YELLOW}$DOCKER_COMPOSE down${NC}"
    echo -e "   Restart application: ${YELLOW}$DOCKER_COMPOSE restart${NC}"
    echo -e "   View status: ${YELLOW}$DOCKER_COMPOSE ps${NC}"
    echo -e "   Backup database: ${YELLOW}npm run backup:db${NC}"

    log "Production deployment completed successfully"
}

# Handle script interruption
trap 'error_exit "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"
