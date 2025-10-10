FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql15-client \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && ln -sf python3 /usr/bin/python

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies for building (including devDependencies for Tailwind)
RUN npm ci --no-audit --no-fund || \
    (rm -f package-lock.json && npm install --no-audit --no-fund) && \
    npm cache clean --force

# Copy source code
COPY . .

# Create necessary directories for building
RUN mkdir -p public/css logs uploads data

# Build CSS with Tailwind - simplified and working
RUN echo "Building Tailwind CSS..." && \
    ./node_modules/.bin/tailwindcss -i ./src/input.css -o ./public/css/tailwind.css --minify && \
    echo "CSS build completed" && \
    ls -la public/css/tailwind.css && \
    echo "Tailwind CSS file size:" && \
    du -h public/css/tailwind.css

# Production stage
FROM node:20-alpine AS production

# Labels for Unraid template
LABEL org.opencontainers.image.title="IT Asset Manager"
LABEL org.opencontainers.image.description="Comprehensive IT Asset Management System"
LABEL org.opencontainers.image.authors="drkpulse"
LABEL org.opencontainers.image.url="https://github.com/Drkpulse/inv_manager"
LABEL org.opencontainers.image.source="https://github.com/Drkpulse/inv_manager"
LABEL org.opencontainers.image.version="1.0.0"
LABEL maintainer="drkpulse"

# Install runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    postgresql15-client \
    curl \
    wget \
    netcat-openbsd \
    tini \
    dumb-init \
    ca-certificates \
    tzdata \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ttf-freefont \
    shadow \
    su-exec \
    bash \
    openssl \
    coreutils \
    procps \
    && rm -rf /var/cache/apk/* /tmp/*

# Set Puppeteer configuration
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

# Create app user with configurable UID/GID for container compatibility
ARG PUID=99
ARG PGID=100
ENV PUID=${PUID} \
    PGID=${PGID}

# Set working directory
WORKDIR /app

# Copy package files first for production dependencies
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy built assets and source code from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/database ./database
COPY --from=builder /app/tools ./tools

# Copy configuration files and migration scripts from builder stage
COPY --from=builder /app/tailwind.config.js ./
COPY --from=builder /app/postcss.config.js ./

# Create necessary directories
RUN mkdir -p \
    /app/uploads \
    /app/logs \
    /app/data \
    /app/config \
    /app/backups \
    /config

# Create entrypoint script with better error handling
COPY <<'EOF' /app/entrypoint.sh
#!/bin/bash

# Function to log with timestamp - both to stdout and stderr for visibility
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" >&1
    echo "$message" >&2
}

# Function to log errors and exit
error_exit() {
    log "ERROR: $1"
    log "Container will exit in 10 seconds to allow log viewing..."
    sleep 10
    exit 1
}

echo "=========================================="
echo "🚀 IT Asset Manager Container Starting..."
echo "=========================================="
log "Timestamp: $(date)"
log "User Configuration: PUID=${PUID}, PGID=${PGID}"
log "Timezone: ${TZ:-UTC}"
log "Environment: ${NODE_ENV:-production}"

# Create necessary directories
mkdir -p /app/logs /app/uploads /app/data /app/backups /config
chmod 755 /app/logs /app/uploads /app/data /app/backups /config

log "Creating user and group with specified IDs..."

# Create group if it doesn't exist
if ! getent group appuser >/dev/null 2>&1; then
    addgroup -g ${PGID} appuser
    log "Created group 'appuser' with GID ${PGID}"
fi

# Create user if it doesn't exist
if ! getent passwd appuser >/dev/null 2>&1; then
    adduser -D -u ${PUID} -G appuser -s /bin/sh appuser
    log "Created user 'appuser' with UID ${PUID}"
fi

# Set ownership of app directories
chown -R appuser:appuser /app /config 2>/dev/null || true
log "Directory permissions configured"

# Environment variable validation
log "🔍 Validating environment variables..."
log "======================================"

# Check DB_HOST first
log "Checking DB_HOST..."
if [ -z "$DB_HOST" ]; then
    error_exit "DB_HOST environment variable is required but not set
💡 SOLUTION: Set DB_HOST to your PostgreSQL container IP address
💡 Find this in Unraid Docker tab → PostgreSQL container → Show more settings → Network
💡 Edit container: Docker tab → IT-Asset-Manager → Edit → Set DB_HOST field
💡 Example: DB_HOST=172.17.0.2"
else
    log "✅ DB_HOST is set: $DB_HOST"
fi

# Check DB_PASSWORD
log "Checking DB_PASSWORD..."
if [ -z "$DB_PASSWORD" ]; then
    error_exit "DB_PASSWORD environment variable is required but not set
💡 SOLUTION: Set DB_PASSWORD to your PostgreSQL password in Unraid container settings
💡 This should match the password you set for your PostgreSQL container
💡 Edit container: Docker tab → IT-Asset-Manager → Edit → Set DB_PASSWORD field"
else
    log "✅ DB_PASSWORD is set (hidden for security)"
fi

# Handle SESSION_SECRET
log "Checking SESSION_SECRET..."
if [ -z "$SESSION_SECRET" ]; then
    log "ℹ️  SESSION_SECRET not set, generating secure random one"
    export SESSION_SECRET="$(openssl rand -base64 64 2>/dev/null || echo "fallback-session-secret-$(date +%s)-$$")"
    log "✅ Generated SESSION_SECRET for this session"
else
    log "✅ SESSION_SECRET is already set"
fi

log "✅ Environment variable validation completed"

# Database connection test
log "🔗 Testing database connection..."
log "================================="
if [ "$DB_HOST" != "localhost" ] && [ -n "$DB_HOST" ]; then
    log "Attempting to connect to PostgreSQL at $DB_HOST:${DB_PORT:-5432}..."
    max_attempts=15
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        log "Connection attempt $attempt/$max_attempts..."
        if nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; then
            log "✅ Database connection successful!"
            break
        fi

        if [ $((attempt % 3)) -eq 0 ]; then
            log "⏳ Still waiting for database... (attempt $attempt/$max_attempts)"
            log "   Checking: $DB_HOST:${DB_PORT:-5432}"
        fi

        sleep 3
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        error_exit "Could not connect to database after ${max_attempts} attempts
💡 TROUBLESHOOTING:
   1. Check that PostgreSQL container is running
   2. Verify DB_HOST ($DB_HOST) is correct
   3. Verify DB_PORT (${DB_PORT:-5432}) is correct
   4. Check network connectivity between containers
   5. Run: docker logs PostgreSQL
💡 Find PostgreSQL IP: Docker tab → PostgreSQL → Show → Network"
    fi
else
    log "⚠️  Skipping database connection test (localhost or empty DB_HOST)"
fi

# Database initialization
if [ "$INIT_DB" = "true" ]; then
    log "✅ Database initialization requested (INIT_DB=true)" "INFO"
    log "⏳ Waiting 5 seconds before starting initialization..." "DEBUG"
    sleep 5

    log "🔧 Running database schema initialization..." "INFO"
    if su-exec appuser:appuser node database/init-db.js; then
        log "✅ Database schema created successfully" "INFO"

        # Run migrations separately after schema creation
        log "🔄 Running database migrations..." "INFO"
        if su-exec appuser:appuser node database/run-migrations.js; then
            log "✅ Database migrations completed successfully" "INFO"
        else
            log "⚠️  Database migrations failed - check logs for details" "WARN"
        fi
    else
        log "⚠️  Database initialization failed - this might be normal if database already exists" "WARN"
        log "   Running migrations anyway in case schema exists..." "DEBUG"

        # Try to run migrations even if init-db failed (database might already exist)
        if su-exec appuser:appuser node database/run-migrations.js; then
            log "✅ Database migrations completed successfully" "INFO"
        else
            log "❌ Database migrations also failed - check configuration" "ERROR"
        fi
    fi
else
    log "ℹ️  Database initialization skipped (INIT_DB=false)" "DEBUG"
    log "🔄 Running any pending database migrations..." "INFO"

    # Even if INIT_DB=false, we should run pending migrations
    if su-exec appuser:appuser node database/run-migrations.js; then
        log "✅ Database migrations completed successfully" "INFO"
    else
        log "⚠️  Database migrations failed - check logs for details" "WARN"
    fi
fi

# Pre-flight checks
log "🔍 Running pre-flight checks..."
log "==============================="

if [ ! -f "src/app.js" ]; then
    error_exit "Application file src/app.js not found in container"
fi

if [ ! -f "package.json" ]; then
    error_exit "package.json not found in container"
fi

log "✅ Pre-flight checks completed"

# Final startup
log "🚀 Starting IT Asset Manager application..."
log "==========================================="
log "Container User: $(whoami)"
log "Working Directory: $(pwd)"
log "Node Version: $(node --version)"
log "Environment: ${NODE_ENV:-production}"
log "Port: ${PORT:-3000}"
log "==========================================="

echo
echo "🎉 CONTAINER STARTUP COMPLETED SUCCESSFULLY"
echo "📊 Application logs will appear below:"
echo "=========================================="
echo

# Execute the main application command as the appuser
log "🚀 Starting Node.js application with command: $*"
log "Arguments passed: $#"
log "Current user: $(whoami)"
log "Target user: appuser:appuser"

# Debug: Show what command will be executed
if [ $# -eq 0 ]; then
    log "⚠️  No command arguments provided to entrypoint"
    log "This might indicate a Docker configuration issue"
    log "Expected: node --trace-warnings --enable-source-maps src/app.js"
    error_exit "No command provided to execute"
else
    log "✅ Command to execute: $*"
fi

# Execute the main command as the appuser
log "🔄 Switching to appuser and executing command..."
exec su-exec appuser:appuser "$@"
EOF

RUN chmod +x /app/entrypoint.sh

# Set environment variables with container-friendly defaults
# Note: Sensitive variables (DB_PASSWORD, SESSION_SECRET) must be provided at runtime
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024 --unhandled-rejections=warn" \
    UV_THREADPOOL_SIZE=4 \
    PORT=3000 \
    DB_PORT=5432 \
    DB_NAME=inventory_db \
    DB_USER=postgres \
    REDIS_PORT=6379 \
    INIT_DB=false \
    TZ=UTC \
    PUID=99 \
    PGID=100 \
    LOG_LEVEL=info \
    INFO_LEVEL=info \
    MAX_FILE_SIZE=10MB \
    ENABLE_CLUSTERING=false \
    CLUSTER_WORKERS=0 \
    DOCKER_CONTAINER=true \
    SESSION_DIR=/config/sessions

# Expose port
EXPOSE 3000

# Define volumes for data persistence
VOLUME ["/app/uploads", "/app/logs", "/app/data", "/app/backups", "/config"]

# Create a simple health check script with conditional logging
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
    echo '# Health check script with conditional logging' >> /app/healthcheck.sh && \
    echo 'if [ "${LOG_LEVEL:-${INFO_LEVEL:-info}}" = "debug" ]; then' >> /app/healthcheck.sh && \
    echo '  echo "[$(date)] Health check starting..."' >> /app/healthcheck.sh && \
    echo 'fi' >> /app/healthcheck.sh && \
    echo 'if wget --no-verbose --tries=1 --timeout=5 --spider http://localhost:${PORT:-3000}/health 2>/dev/null; then' >> /app/healthcheck.sh && \
    echo '  if [ "${LOG_LEVEL:-${INFO_LEVEL:-info}}" = "debug" ]; then' >> /app/healthcheck.sh && \
    echo '    echo "[$(date)] Health check passed"' >> /app/healthcheck.sh && \
    echo '  fi' >> /app/healthcheck.sh && \
    echo '  exit 0' >> /app/healthcheck.sh && \
    echo 'else' >> /app/healthcheck.sh && \
    echo '  if [ "${LOG_LEVEL:-${INFO_LEVEL:-info}}" = "debug" ]; then' >> /app/healthcheck.sh && \
    echo '    echo "[$(date)] Health check failed"' >> /app/healthcheck.sh && \
    echo '  fi' >> /app/healthcheck.sh && \
    echo '  exit 1' >> /app/healthcheck.sh && \
    echo 'fi' >> /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Health check with fallback options
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD /app/healthcheck.sh || curl -f http://localhost:${PORT:-3000}/health || nc -z localhost ${PORT:-3000} || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]

# Default command optimized for containers
CMD ["node", "--trace-warnings", "--enable-source-maps", "src/app.js"]
