# TaDashboard Makefile
# Simplified build & deployment commands

.PHONY: dev build start lint test install db-push db-generate docker docker-up docker-down docker-logs deploy-k3s clean help

# Default target
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────

install: ## Install dependencies
	bun install

dev: ## Start dev server on port 3000
	bun run dev

lint: ## Run ESLint
	bun run lint

test: ## Run tests
	bun run test

test:watch: ## Run tests in watch mode
	bun run test:watch

test:coverage: ## Run tests with coverage
	bun run test:coverage

# ── Database ─────────────────────────────────────────────

db-push: ## Push Prisma schema to database
	bun run db:push

db-generate: ## Generate Prisma client
	bun run db:generate

db-migrate: ## Create and apply migration
	bun run db:migrate

# ── Build & Run ──────────────────────────────────────────

build: ## Build for production
	bun run build

start: ## Start production server
	bun run start

# ── Docker ───────────────────────────────────────────────

docker: ## Build Docker image
	docker build -t hiclaw-dashboard:latest .

docker-up: ## Start with Docker Compose
	docker compose up -d

docker-down: ## Stop Docker Compose
	docker compose down

docker-logs: ## Follow Docker Compose logs
	docker compose logs -f app

docker-rebuild: ## Rebuild and restart Docker Compose
	docker compose up -d --build

# ── K3s Deployment ───────────────────────────────────────

deploy-k3s: ## Build image and deploy to k3s
	@./scripts/build-and-load-image.sh
	@./scripts/deploy-k3s.sh

# ── Cleanup ──────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf .next out dist build coverage