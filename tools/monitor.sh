#!/bin/bash

# IT Asset Manager - System Monitoring Script
set -euo pipefail

# Configuration
MONITOR_INTERVAL=${MONITOR_INTERVAL:-60}  # seconds
LOG_FILE="logs/monitor.log"
ALERT_THRESHOLD_CPU=${ALERT_THRESHOLD_CPU:-80}
ALERT_THRESHOLD_MEMORY=${ALERT_THRESHOLD_MEMORY:-80}
ALERT_THRESHOLD_DISK=${ALERT_THRESHOLD_DISK:-90}
HEALTH_CHECK_URL="http://localhost:3000/health"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory
mkdir -p logs

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

alert() {
    echo -e "${RED}🚨 ALERT: $1${NC}" >&2
    log "ALERT: $1"

    # You can add email/webhook notifications here
    # send_notification "$1"
}

warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    log "WARNING: $1"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

# System metrics collection
get_cpu_usage() {
    top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' | sed 's/%us,//'
}

get_memory_usage() {
    free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}'
}

get_disk_usage() {
    df . | awk 'NR==2 {print $5}' | sed 's/%//'
}

get_load_average() {
    uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs
}

# Docker containers monitoring
check_container_health() {
    local container_name=$1
    local status

    if docker-compose ps "$container_name" 2>/dev/null | grep -q "Up"; then
        status="healthy"
        # Additional health check for app container
        if [[ "$container_name" == "app" ]]; then
            if ! curl -sf "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
                status="unhealthy"
            fi
        fi
    else
        status="down"
    fi

    echo "$status"
}

# Database monitoring
check_database_connections() {
    local connections
    connections=$(docker-compose exec -T postgres psql -U postgres -d inventory_db -c "SELECT count(*) FROM pg_stat_activity;" -t 2>/dev/null | xargs || echo "0")
    echo "$connections"
}

check_database_size() {
    local size
    size=$(docker-compose exec -T postgres psql -U postgres -d inventory_db -c "SELECT pg_size_pretty(pg_database_size('inventory_db'));" -t 2>/dev/null | xargs || echo "Unknown")
    echo "$size"
}

# Redis monitoring
check_redis_memory() {
    local memory
    memory=$(docker-compose exec -T redis redis-cli info memory | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r\n' || echo "Unknown")
    echo "$memory"
}

check_redis_connections() {
    local connections
    connections=$(docker-compose exec -T redis redis-cli info clients | grep "connected_clients:" | cut -d: -f2 | tr -d '\r\n' || echo "0")
    echo "$connections"
}

# Application monitoring
check_response_time() {
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}\n' "$HEALTH_CHECK_URL" 2>/dev/null || echo "timeout")
    echo "$response_time"
}

# Log analysis
check_error_rate() {
    local error_count
    local total_requests

    # Count errors in last hour from logs
    error_count=$(find logs -name "*.log" -mmin -60 -exec grep -c "ERROR\|error\|Error" {} + 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    total_requests=$(find logs -name "*.log" -mmin -60 -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')

    if [[ $total_requests -gt 0 ]]; then
        echo "scale=2; $error_count * 100 / $total_requests" | bc -l 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Network monitoring
check_network_connections() {
    local connections
    connections=$(netstat -an | grep :3000 | grep ESTABLISHED | wc -l)
    echo "$connections"
}

# Security monitoring
check_failed_logins() {
    local failed_logins
    failed_logins=$(find logs -name "*.log" -mmin -60 -exec grep -c "authentication failed\|login failed\|invalid credentials" {} + 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
    echo "$failed_logins"
}

# Generate monitoring report
generate_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # System metrics
    local cpu_usage=$(get_cpu_usage)
    local memory_usage=$(get_memory_usage)
    local disk_usage=$(get_disk_usage)
    local load_avg=$(get_load_average)

    # Container health
    local app_status=$(check_container_health "app")
    local postgres_status=$(check_container_health "postgres")
    local redis_status=$(check_container_health "redis")
    local nginx_status=$(check_container_health "nginx")

    # Database metrics
    local db_connections=$(check_database_connections)
    local db_size=$(check_database_size)

    # Redis metrics
    local redis_memory=$(check_redis_memory)
    local redis_connections=$(check_redis_connections)

    # Application metrics
    local response_time=$(check_response_time)
    local error_rate=$(check_error_rate)
    local network_connections=$(check_network_connections)
    local failed_logins=$(check_failed_logins)

    # Generate JSON report for structured logging
    cat << EOF > "logs/metrics_$(date +%Y%m%d_%H%M%S).json"
{
  "timestamp": "$timestamp",
  "system": {
    "cpu_usage": $cpu_usage,
    "memory_usage": $memory_usage,
    "disk_usage": $disk_usage,
    "load_average": "$load_avg"
  },
  "containers": {
    "app": "$app_status",
    "postgres": "$postgres_status",
    "redis": "$redis_status",
    "nginx": "$nginx_status"
  },
  "database": {
    "connections": $db_connections,
    "size": "$db_size"
  },
  "redis": {
    "memory": "$redis_memory",
    "connections": $redis_connections
  },
  "application": {
    "response_time": "$response_time",
    "error_rate": $error_rate,
    "network_connections": $network_connections,
    "failed_logins": $failed_logins
  }
}
EOF

    # Console output
    echo -e "\n${BLUE}📊 System Monitoring Report - $timestamp${NC}"
    echo "=============================================="

    # System health
    echo -e "\n${BLUE}🖥️  System Health:${NC}"
    printf "  CPU Usage: %s%% " "$cpu_usage"
    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        echo -e "${RED}(HIGH)${NC}"
        alert "High CPU usage: $cpu_usage%"
    elif (( $(echo "$cpu_usage > 60" | bc -l) )); then
        echo -e "${YELLOW}(MEDIUM)${NC}"
    else
        echo -e "${GREEN}(NORMAL)${NC}"
    fi

    printf "  Memory Usage: %s%% " "$memory_usage"
    if [[ $memory_usage -gt $ALERT_THRESHOLD_MEMORY ]]; then
        echo -e "${RED}(HIGH)${NC}"
        alert "High memory usage: $memory_usage%"
    elif [[ $memory_usage -gt 60 ]]; then
        echo -e "${YELLOW}(MEDIUM)${NC}"
    else
        echo -e "${GREEN}(NORMAL)${NC}"
    fi

    printf "  Disk Usage: %s%% " "$disk_usage"
    if [[ $disk_usage -gt $ALERT_THRESHOLD_DISK ]]; then
        echo -e "${RED}(HIGH)${NC}"
        alert "High disk usage: $disk_usage%"
    elif [[ $disk_usage -gt 70 ]]; then
        echo -e "${YELLOW}(MEDIUM)${NC}"
    else
        echo -e "${GREEN}(NORMAL)${NC}"
    fi

    echo "  Load Average: $load_avg"

    # Container status
    echo -e "\n${BLUE}🐳 Container Status:${NC}"
    for container in app postgres redis nginx; do
        local status
        status=$(check_container_health "$container")
        printf "  %-10s: " "$container"
        case $status in
            "healthy"|"up")
                echo -e "${GREEN}✅ $status${NC}"
                ;;
            "unhealthy")
                echo -e "${YELLOW}⚠️  $status${NC}"
                warning "Container $container is unhealthy"
                ;;
            "down")
                echo -e "${RED}❌ $status${NC}"
                alert "Container $container is down"
                ;;
        esac
    done

    # Database info
    echo -e "\n${BLUE}🗄️  Database:${NC}"
    echo "  Connections: $db_connections"
    echo "  Size: $db_size"

    # Redis info
    echo -e "\n${BLUE}🔴 Redis:${NC}"
    echo "  Memory Usage: $redis_memory"
    echo "  Connections: $redis_connections"

    # Application metrics
    echo -e "\n${BLUE}🌐 Application:${NC}"
    echo "  Response Time: ${response_time}s"
    echo "  Error Rate: $error_rate%"
    echo "  Active Connections: $network_connections"

    # Security alerts
    if [[ $failed_logins -gt 10 ]]; then
        alert "High number of failed logins in last hour: $failed_logins"
    fi

    echo ""
}

# Cleanup old metric files
cleanup_old_metrics() {
    find logs -name "metrics_*.json" -mtime +7 -delete 2>/dev/null || true
}

# Main monitoring loop
main() {
    echo -e "${BLUE}"
    echo "📊 IT Asset Manager - System Monitor"
    echo "===================================="
    echo -e "${NC}"

    info "Starting system monitoring (interval: ${MONITOR_INTERVAL}s)"
    info "Thresholds - CPU: ${ALERT_THRESHOLD_CPU}%, Memory: ${ALERT_THRESHOLD_MEMORY}%, Disk: ${ALERT_THRESHOLD_DISK}%"

    while true; do
        generate_report
        cleanup_old_metrics

        if [[ "${1:-}" != "--once" ]]; then
            sleep "$MONITOR_INTERVAL"
        else
            break
        fi
    done
}

# Handle script interruption
trap 'info "Monitoring stopped"; exit 0' INT TERM

# Run monitoring
main "$@"
