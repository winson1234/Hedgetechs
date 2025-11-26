#!/bin/bash
# Deployment script for Contabo VPS
# Usage: ./deployment/deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment to Contabo VPS..."

# Configuration
PROJECT_DIR="/opt/brokerageProject"
COMPOSE_FILE="deployment/docker-compose.prod.yml"
ENV_FILE=".env.prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Don't run as root! Use: sudo -u yourusername ./deploy.sh${NC}"
    exit 1
fi

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ $ENV_FILE not found!${NC}"
    echo "Create it from .env.example and set production values"
    exit 1
fi

# Pull latest code from Git (optional)
# echo "📥 Pulling latest code from GitHub..."
# git pull origin main

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f $COMPOSE_FILE down

# Remove old images (optional - saves disk space)
echo "🧹 Cleaning up old images..."
docker image prune -f

# Build new images
echo "🏗️  Building Docker images..."
docker compose -f $COMPOSE_FILE build --no-cache

# Start containers
echo "▶️  Starting containers..."
docker compose -f $COMPOSE_FILE up -d

# Wait for health checks
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check container status
echo "📊 Container status:"
docker compose -f $COMPOSE_FILE ps

# Check backend health
echo "🩺 Checking backend health..."
if curl -f -s http://127.0.0.1:8080/api/v1/ticker?symbols=BTCUSDT > /dev/null; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed!${NC}"
    docker compose -f $COMPOSE_FILE logs backend
    exit 1
fi

# Check frontend health
echo "🩺 Checking frontend health..."
if curl -f -s http://127.0.0.1:3000/ > /dev/null; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed!${NC}"
    docker compose -f $COMPOSE_FILE logs frontend
    exit 1
fi

# Show logs
echo "📋 Recent logs:"
docker compose -f $COMPOSE_FILE logs --tail=50

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🌐 Your app is now running at:"
echo "   - Backend:  http://127.0.0.1:8080"
echo "   - Frontend: http://127.0.0.1:3000"
echo ""
echo "📊 Monitor logs with: docker compose -f $COMPOSE_FILE logs -f"
echo "🛑 Stop services with: docker compose -f $COMPOSE_FILE down"