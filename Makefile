.PHONY: dev dev-build dev-down dev-clean dev-logs dev-db dev-reset

# Start development environment
dev:
	docker compose -f docker-compose.dev.yml --env-file .env.dev up

# Build and start
dev-build:
	docker compose -f docker-compose.dev.yml --env-file .env.dev up --build

# Stop
dev-down:
	docker compose -f docker-compose.dev.yml down

# Clean (including volumes)
dev-clean:
	docker compose -f docker-compose.dev.yml down -v
	rm -rf tmp/

# View all logs
dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

# View backend logs only
dev-logs-backend:
	docker compose -f docker-compose.dev.yml logs -f backend

# View frontend logs only
dev-logs-frontend:
	docker compose -f docker-compose.dev.yml logs -f frontend

# Access database shell
dev-db:
	docker exec -it brokerage-postgres-dev psql -U postgres -d brokerage_dev

# Reset database (destructive)
dev-reset:
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	docker compose -f docker-compose.dev.yml up -d

# Backup database
dev-backup:
	mkdir -p backups
	docker exec brokerage-postgres-dev pg_dump -U postgres brokerage_dev > backups/dev_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in backups/"

# Shell into backend container
dev-shell-backend:
	docker exec -it brokerage-backend-dev sh

# Shell into frontend container
dev-shell-frontend:
	docker exec -it brokerage-frontend-dev sh

# Production commands
prod-up:
	docker compose -f deployment/docker-compose.prod.yml --env-file .env.prod up -d --build

prod-down:
	docker compose -f deployment/docker-compose.prod.yml down

prod-logs:
	docker compose -f deployment/docker-compose.prod.yml logs -f