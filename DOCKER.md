# 🐳 Docker Deployment Guide

This guide covers deploying IT Asset Manager using Docker with proper container variables for various platforms including Unraid, Synology, QNAP, and standard Docker setups.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB+ RAM available
- 10GB+ disk space
- PostgreSQL database (can be containerized)

## 🚀 Quick Start with Docker Compose

### 1. Copy the Example Configuration

```bash
# Copy the example docker-compose file
cp docker-compose.example.yml docker-compose.yml

# Copy the environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit the `.env` file with your settings:

```bash
# Container Configuration (important for Unraid/NAS)
PUID=99                    # User ID (check with `id` command)
PGID=100                   # Group ID (check with `id` command)
TZ=America/New_York        # Your timezone

# Database Configuration
DB_PASSWORD=your_secure_password_here
SESSION_SECRET=your_very_secure_session_secret

# Optional: Redis for better performance
REDIS_HOST=redis
```

### 3. Deploy the Stack

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Access the Application

- **Web Interface**: http://localhost:3000
- **Default Login**: admin@example.com / admin
- **Health Check**: http://localhost:3000/health

## 🏠 Platform-Specific Deployments

### Unraid Configuration

In Unraid's Docker template, use these container variables:

```yaml
Container Variables:
  - PUID: 99
  - PGID: 100
  - TZ: America/New_York
  - DB_HOST: [your-postgres-container-ip-or-name]
  - DB_PASSWORD: [your-secure-password]
  - SESSION_SECRET: [generate-with-openssl-rand-base64-32]
  - INIT_DB: true
  - NODE_ENV: production

Container Paths:
  - /app/uploads -> /mnt/path/to/uploads
  - /app/logs -> /mnt/path/to/logs
  - /app/data -> /mnt/path/to/data
  - /app/backups -> /mnt/path/to/backups

Container Ports:
  - 3000:3000
```

### Synology DSM / QNAP

Use the built-in Docker app with these environment variables:

```bash
PUID=1026              # Check with SSH: id username
PGID=100               # Check with SSH: id username
TZ=Europe/London       # Your timezone
DB_HOST=postgres
DB_PASSWORD=secure_password
SESSION_SECRET=random_secret_here
```

### Portainer Configuration

Create a new stack with this compose content:

```yaml
version: '3.8'
services:
  app:
    image: your-registry/it-asset-manager:latest
    environment:
      PUID: 1000
      PGID: 1000
      TZ: UTC
      DB_HOST: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      SESSION_SECRET: ${SESSION_SECRET}
    volumes:
      - app_data:/app/data
      - app_uploads:/app/uploads
      - app_logs:/app/logs
    ports:
      - "3000:3000"
```

## 🔧 Container Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | Database hostname | `postgres` or `192.168.1.100` |
| `DB_PASSWORD` | Database password | `secure_password_123` |
| `SESSION_SECRET` | Session encryption key | `generated_with_openssl_rand` |

### Container Identity Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `99` | User ID for file permissions |
| `PGID` | `100` | Group ID for file permissions |
| `TZ` | `UTC` | Container timezone |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `inventory_db` | Database name |
| `DB_USER` | `postgres` | Database username |
| `INIT_DB` | `false` | Initialize database on startup |
| `REDIS_HOST` | `""` | Redis hostname for caching |
| `LOG_LEVEL` | `info` | Logging level (error/warn/info/debug) |
| `MAX_FILE_SIZE` | `10MB` | Maximum upload file size |
| `ENABLE_CLUSTERING` | `false` | Enable multi-core processing |

## 💾 Data Persistence

The container uses these volumes for data persistence:

```bash
/app/uploads    # File uploads and attachments
/app/logs       # Application and access logs
/app/data       # Application data and cache
/app/backups    # Database and file backups
/config         # Additional configuration files
```

### Volume Mapping Examples

```bash
# Local directories
-v /host/path/uploads:/app/uploads
-v /host/path/logs:/app/logs

# Named volumes
-v app_uploads:/app/uploads
-v app_logs:/app/logs

# NFS/SMB shares (for NAS systems)
-v /mnt/share/it-manager/uploads:/app/uploads
```

## 🏥 Health Monitoring

The container includes comprehensive health checks:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' container_name

# Manual health check
docker exec container_name /app/healthcheck.sh

# Health check endpoint
curl http://localhost:3000/health
```

## 🔍 Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Fix: Adjust PUID/PGID to match your system
   PUID=$(id -u)
   PGID=$(id -g)
   ```

2. **Database Connection Failed**
   ```bash
   # Check database container status
   docker-compose logs postgres

   # Test database connectivity
   docker exec app nc -z postgres 5432
   ```

3. **Container Won't Start**
   ```bash
   # Check container logs
   docker-compose logs app

   # Verify environment variables
   docker-compose config
   ```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
LOG_LEVEL=debug
NODE_ENV=development

# Restart with debug output
docker-compose up -d && docker-compose logs -f app
```

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest image
docker-compose pull app

# Restart with new image
docker-compose up -d app

# Clean up old images
docker image prune
```

### Backup Procedures

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres inventory_db > backup.sql

# Backup volumes
docker run --rm -v app_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /data .

# Backup configuration
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup
```

### Performance Tuning

For high-load environments:

```bash
# Enable clustering
ENABLE_CLUSTERING=true
CLUSTER_WORKERS=4

# Increase memory limit
NODE_OPTIONS=--max-old-space-size=2048

# Use Redis for sessions
REDIS_HOST=redis
REDIS_URL=redis://redis:6379
```

## 📞 Support

For Docker-specific issues:

1. Check the [Docker Hub repository](https://hub.docker.com/r/your-username/it-asset-manager)
2. Review container logs with `docker-compose logs app`
3. Submit issues with your docker-compose.yml and environment variables (remove sensitive data)
4. Include output from `docker-compose config` for configuration validation
