#!/bin/bash

# IT Asset Manager - Backup Script
set -euo pipefail

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
COMPRESS_BACKUPS=${COMPRESS_BACKUPS:-true}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$BACKUP_DIR/backup.log"
}

error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING: $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose not found"
fi

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    error "Application containers are not running"
fi

info "Starting backup process..."

# Database backup
backup_database() {
    info "Creating database backup..."

    local db_backup_file="$BACKUP_DIR/database_${TIMESTAMP}.sql"

    # Get database credentials from environment
    local db_name=${DB_NAME:-inventory_db}
    local db_user=${DB_USER:-postgres}

    if docker-compose exec -T postgres pg_dump -U "$db_user" "$db_name" > "$db_backup_file" 2>/dev/null; then
        if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
            gzip "$db_backup_file"
            db_backup_file="${db_backup_file}.gz"
        fi

        local file_size=$(du -h "$db_backup_file" | cut -f1)
        success "Database backup created: $(basename "$db_backup_file") ($file_size)"
        return 0
    else
        error "Failed to create database backup"
    fi
}

# Files backup
backup_files() {
    info "Creating files backup..."

    local files_to_backup=()

    # Check for uploads directory
    if [[ -d "uploads" ]]; then
        files_to_backup+=("uploads/")
    fi

    # Check for logs directory
    if [[ -d "logs" ]]; then
        files_to_backup+=("logs/")
    fi

    # Check for SSL certificates
    if [[ -d "ssl" ]]; then
        files_to_backup+=("ssl/")
    fi

    # Backup configuration files
    if [[ -f ".env" ]]; then
        files_to_backup+=(".env")
    fi

    if [[ ${#files_to_backup[@]} -eq 0 ]]; then
        warning "No files to backup"
        return 0
    fi

    local files_backup_file="$BACKUP_DIR/files_${TIMESTAMP}.tar"

    if tar -cf "$files_backup_file" "${files_to_backup[@]}" 2>/dev/null; then
        if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
            gzip "$files_backup_file"
            files_backup_file="${files_backup_file}.gz"
        fi

        local file_size=$(du -h "$files_backup_file" | cut -f1)
        success "Files backup created: $(basename "$files_backup_file") ($file_size)"
        return 0
    else
        error "Failed to create files backup"
    fi
}

# Redis backup
backup_redis() {
    info "Creating Redis backup..."

    local redis_backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

    if docker-compose exec -T redis redis-cli --rdb - > "$redis_backup_file" 2>/dev/null; then
        if [[ -s "$redis_backup_file" ]]; then
            if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
                gzip "$redis_backup_file"
                redis_backup_file="${redis_backup_file}.gz"
            fi

            local file_size=$(du -h "$redis_backup_file" | cut -f1)
            success "Redis backup created: $(basename "$redis_backup_file") ($file_size)"
        else
            warning "Redis backup is empty, removing file"
            rm -f "$redis_backup_file"
        fi
    else
        warning "Failed to create Redis backup (non-critical)"
    fi
}

# Create comprehensive backup
create_full_backup() {
    info "Creating comprehensive backup..."

    local full_backup_file="$BACKUP_DIR/full_backup_${TIMESTAMP}.tar"
    local temp_dir=$(mktemp -d)

    # Create temporary structure
    mkdir -p "$temp_dir/backup_$TIMESTAMP"

    # Copy individual backups
    find "$BACKUP_DIR" -name "*_${TIMESTAMP}.*" -exec cp {} "$temp_dir/backup_$TIMESTAMP/" \;

    # Add metadata
    cat > "$temp_dir/backup_$TIMESTAMP/backup_info.txt" << EOF
Backup Information
==================
Date: $(date)
Timestamp: $TIMESTAMP
Host: $(hostname)
User: $(whoami)
Docker Compose Status:
$(docker-compose ps)

Environment:
$(docker-compose config)
EOF

    # Create archive
    if tar -cf "$full_backup_file" -C "$temp_dir" "backup_$TIMESTAMP" 2>/dev/null; then
        if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
            gzip "$full_backup_file"
            full_backup_file="${full_backup_file}.gz"
        fi

        local file_size=$(du -h "$full_backup_file" | cut -f1)
        success "Full backup created: $(basename "$full_backup_file") ($file_size)"
    else
        warning "Failed to create comprehensive backup"
    fi

    # Cleanup temporary directory
    rm -rf "$temp_dir"
}

# Cleanup old backups
cleanup_old_backups() {
    info "Cleaning up backups older than $RETENTION_DAYS days..."

    local deleted_count=0

    # Find and delete old backups
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "*.sql*" -o -name "*.tar*" -o -name "*.rdb*" -mtime +$RETENTION_DAYS -print0 2>/dev/null)

    if [[ $deleted_count -gt 0 ]]; then
        success "Cleaned up $deleted_count old backup files"
    else
        info "No old backups to clean up"
    fi
}

# Verify backup integrity
verify_backups() {
    info "Verifying backup integrity..."

    local verification_failed=false

    # Check database backup
    local db_backup=$(find "$BACKUP_DIR" -name "database_${TIMESTAMP}.*" | head -1)
    if [[ -n "$db_backup" ]]; then
        if [[ "$db_backup" == *.gz ]]; then
            if ! gzip -t "$db_backup" 2>/dev/null; then
                warning "Database backup compression is corrupted"
                verification_failed=true
            fi
        fi
    fi

    # Check files backup
    local files_backup=$(find "$BACKUP_DIR" -name "files_${TIMESTAMP}.*" | head -1)
    if [[ -n "$files_backup" ]]; then
        if [[ "$files_backup" == *.gz ]]; then
            if ! gzip -t "$files_backup" 2>/dev/null; then
                warning "Files backup compression is corrupted"
                verification_failed=true
            fi
        elif [[ "$files_backup" == *.tar ]]; then
            if ! tar -tf "$files_backup" >/dev/null 2>&1; then
                warning "Files backup archive is corrupted"
                verification_failed=true
            fi
        fi
    fi

    if [[ "$verification_failed" == "true" ]]; then
        error "Backup verification failed"
    else
        success "All backups verified successfully"
    fi
}

# Generate backup report
generate_report() {
    info "Generating backup report..."

    local report_file="$BACKUP_DIR/backup_report_${TIMESTAMP}.txt"

    cat > "$report_file" << EOF
IT Asset Manager - Backup Report
=================================
Date: $(date)
Timestamp: $TIMESTAMP
Host: $(hostname)

Backup Files Created:
$(find "$BACKUP_DIR" -name "*_${TIMESTAMP}.*" -exec ls -lh {} \;)

Total Backup Size: $(du -sh "$BACKUP_DIR" | cut -f1)

Disk Usage:
$(df -h .)

Available Backups:
$(find "$BACKUP_DIR" -name "*.sql*" -o -name "*.tar*" -o -name "*.rdb*" | sort)

System Status:
$(docker-compose ps)
EOF

    success "Backup report generated: $(basename "$report_file")"
}

# Main backup process
main() {
    echo -e "${BLUE}"
    echo "🗄️  IT Asset Manager - Backup Process"
    echo "====================================="
    echo -e "${NC}"

    # Load environment variables
    if [[ -f ".env" ]]; then
        set -a
        source .env
        set +a
    fi

    backup_database
    backup_files
    backup_redis
    create_full_backup
    verify_backups
    cleanup_old_backups
    generate_report

    echo -e "${GREEN}"
    echo "🎉 Backup process completed successfully!"
    echo "========================================"
    echo -e "${NC}"

    # Show backup summary
    echo -e "${BLUE}📊 Backup Summary:${NC}"
    find "$BACKUP_DIR" -name "*_${TIMESTAMP}.*" -exec ls -lh {} \;

    echo ""
    echo -e "${BLUE}💾 Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)${NC}"
    echo -e "${BLUE}🗂️  Backup location: $BACKUP_DIR${NC}"
}

# Handle script interruption
trap 'error "Backup process interrupted"' INT TERM

# Run main function
main "$@"
