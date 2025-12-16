.PHONY: help dev dev-build dev-down dev-clean dev-logs dev-db dev-reset
.DEFAULT_GOAL := help

## ============================================
## 🚀 QUICK START
## ============================================

help: ## Show this help message
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Hedgetechs Development - Available Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; } /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""

##@ 🏃 Development - Quick Start

dev: ## Start dev environment (recommended)
	@echo "🚀 Starting development environment..."
	docker compose -f docker-compose.dev.yml --env-file .env.dev up

dev-build: ## Build and start (use when Dockerfile changes)
	@echo "🔨 Building and starting development environment..."
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build

dev-daemon: ## Start in background (detached mode)
	@echo "🚀 Starting in background..."
	docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
	@echo "✅ Services running in background"
	@echo "   Frontend: http://localhost:5173"
	@echo "   Backend:  http://localhost:8080"
	@echo ""
	@echo "💡 Use 'make dev-logs' to view logs"
	@echo "💡 Use 'make dev-down' to stop"

##@ 🛑 Stop & Clean

dev-down: ## Stop all services
	@echo "🛑 Stopping services..."
	docker compose -f docker-compose.dev.yml down

dev-clean: ## Clean everything (volumes, tmp files)
	@echo "🧹 Cleaning volumes and temporary files..."
	docker compose -f docker-compose.dev.yml down -v
	rm -rf tmp/
	@echo "✅ Cleaned successfully"

dev-restart: ## Restart all services
	@echo "🔄 Restarting services..."
	docker compose -f docker-compose.dev.yml restart
	@echo "✅ Services restarted"

##@ 📊 Service Management

dev-restart-backend: ## Restart only backend
	docker compose -f docker-compose.dev.yml restart backend

dev-restart-frontend: ## Restart only frontend
	docker compose -f docker-compose.dev.yml restart frontend

dev-restart-db: ## Restart only database
	docker compose -f docker-compose.dev.yml restart postgres

dev-status: ## Show status of all services
	@echo "📊 Service Status:"
	@docker compose -f docker-compose.dev.yml ps

##@ 📝 Logs

dev-logs: ## View all logs (live)
	docker compose -f docker-compose.dev.yml logs -f

dev-logs-backend: ## View backend logs only
	docker compose -f docker-compose.dev.yml logs -f backend

dev-logs-frontend: ## View frontend logs only
	docker compose -f docker-compose.dev.yml logs -f frontend

dev-logs-db: ## View database logs only
	docker compose -f docker-compose.dev.yml logs -f postgres

##@ 🗄️ Database

dev-db: ## Access database shell (psql)
	docker exec -it brokerage-postgres-dev psql -U postgres -d brokerage_dev

dev-db-reset: ## Reset database (⚠️  DESTRUCTIVE - deletes all data)
	@echo "⚠️  WARNING: This will delete ALL database data!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@echo "🗑️  Resetting database..."
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d postgres
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	@sleep 5
	docker compose -f docker-compose.dev.yml up -d
	@echo "✅ Database reset complete"

dev-backup: ## Backup database to backups/ folder
	@mkdir -p backups
	@echo "💾 Creating backup..."
	docker exec brokerage-postgres-dev pg_dump -U postgres brokerage_dev > backups/dev_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created in backups/"

##@ 🔧 Shell Access

dev-shell-backend: ## Open shell in backend container
	docker exec -it brokerage-backend-dev sh

dev-shell-frontend: ## Open shell in frontend container
	docker exec -it brokerage-frontend-dev sh

dev-shell-db: ## Open shell in database container
	docker exec -it brokerage-postgres-dev sh

##@ 🚀 Production

prod-up: ## Start production environment
	docker compose -f deployment/docker-compose.prod.yml --env-file .env.prod up -d --build

prod-down: ## Stop production environment
	docker compose -f deployment/docker-compose.prod.yml down

prod-logs: ## View production logs
	docker compose -f deployment/docker-compose.prod.yml logs -f