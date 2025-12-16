#!/bin/bash

# ============================================
# Production Deployment Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo ""
    echo "Please create .env file first:"
    echo "  cp ../.env.example .env"
    echo "  nano .env"
    echo ""
    exit 1
fi

# Show menu
echo "Choose deployment action:"
echo "  1) Fresh install (stop, remove volumes, rebuild)"
echo "  2) Update and restart (keep data)"
echo "  3) Stop services"
echo "  4) View logs"
echo "  5) Verify database"
echo "  6) Database backup"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}⚠️  WARNING: This will DELETE all existing data!${NC}"
        read -p "Are you sure? Type 'yes' to continue: " confirm
        
        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 0
        fi
        
        echo ""
        echo -e "${BLUE}📦 Stopping services...${NC}"
        docker-compose -f docker-compose.prod.yml down -v
        
        echo ""
        echo -e "${BLUE}🔨 Building images...${NC}"
        docker-compose -f docker-compose.prod.yml build --no-cache
        
        echo ""
        echo -e "${BLUE}🚀 Starting services...${NC}"
        docker-compose -f docker-compose.prod.yml up -d
        
        echo ""
        echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
        sleep 30
        
        echo ""
        echo -e "${BLUE}🔍 Verifying database initialization...${NC}"
        docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "\dt" | head -20
        
        echo ""
        echo -e "${GREEN}✅ Fresh installation complete!${NC}"
        echo ""
        echo "View logs: docker-compose -f docker-compose.prod.yml logs -f"
        ;;
        
    2)
        echo ""
        echo -e "${BLUE}🔨 Pulling latest images...${NC}"
        docker-compose -f docker-compose.prod.yml pull
        
        echo ""
        echo -e "${BLUE}🔨 Building images...${NC}"
        docker-compose -f docker-compose.prod.yml build
        
        echo ""
        echo -e "${BLUE}🔄 Restarting services...${NC}"
        docker-compose -f docker-compose.prod.yml up -d
        
        echo ""
        echo -e "${GREEN}✅ Services updated and restarted!${NC}"
        echo ""
        echo "View logs: docker-compose -f docker-compose.prod.yml logs -f"
        ;;
        
    3)
        echo ""
        echo -e "${BLUE}🛑 Stopping services...${NC}"
        docker-compose -f docker-compose.prod.yml down
        
        echo ""
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
        
    4)
        echo ""
        echo -e "${BLUE}📋 Showing logs (Ctrl+C to exit)...${NC}"
        echo ""
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
        
    5)
        echo ""
        echo -e "${BLUE}🔍 Verifying database...${NC}"
        echo ""
        
        echo "📊 Tables:"
        docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "
        SELECT 
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
        "
        
        echo ""
        echo "👥 User count:"
        docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "SELECT COUNT(*) as user_count FROM users;"
        
        echo ""
        echo "🔔 Notification count:"
        docker exec brokerage-postgres-prod psql -U postgres -d brokerage -c "SELECT COUNT(*) as notification_count FROM notifications;"
        
        echo ""
        echo -e "${GREEN}✅ Database verification complete${NC}"
        ;;
        
    6)
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        echo ""
        echo -e "${BLUE}💾 Creating database backup: $BACKUP_FILE${NC}"
        
        docker exec brokerage-postgres-prod pg_dump -U postgres brokerage > "$BACKUP_FILE"
        
        echo ""
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
        echo "File size: $(du -h $BACKUP_FILE | cut -f1)"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Done!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
