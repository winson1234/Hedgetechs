cat > deployment/deploy.sh << 'EOF'
#!/bin/bash
# Deployment script for Contabo VPS

set -e

echo "🚀 Starting deployment..."

# Configuration
PROJECT_ROOT="/root/home/hedgetechs"
COMPOSE_FILE="deployment/docker-compose.prod.yml"
ENV_FILE=".env.prod"

# Navigate to project root
cd "$PROJECT_ROOT"

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found in $PROJECT_ROOT!"
    exit 1
fi

# Verify critical variables
source "$ENV_FILE"
if [ -z "$REDIS_PASSWORD" ] || [ -z "$DATABASE_URL" ]; then
    echo "❌ Critical environment variables missing!"
    exit 1
fi

echo "✅ Environment variables loaded"

# Stop existing containers
echo "🛑 Stopping containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

# Clean up
echo "🧹 Cleaning up..."
docker image prune -f

# Build and start
echo "🏗️  Building and starting..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# Wait for health checks
echo "⏳ Waiting for services..."
sleep 15

# Check status
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

# Health checks
echo "🩺 Checking backend..."
if curl -f -s http://127.0.0.1:8080/api/v1/ticker?symbols=BTCUSDT > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend failed!"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs backend
    exit 1
fi

echo "🩺 Checking frontend..."
if curl -f -s http://127.0.0.1:3000/ > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend failed!"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs frontend
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo "📊 View logs: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
EOF

chmod +x deployment/deploy.sh