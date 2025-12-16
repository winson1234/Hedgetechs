#!/bin/bash
# Start development environment

set -e

echo "🚀 Starting development environment..."

# Check if .env.dev exists
if [ ! -f ".env.dev" ]; then
    echo "❌ .env.dev not found!"
    echo "💡 Copy .env.example to .env.dev and configure it"
    exit 1
fi

# Start services
docker compose -f docker-compose.dev.yml --env-file .env.dev up


