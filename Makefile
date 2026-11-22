# PTE Master AI: one-command local setup (SPEC 3.4). Run `make help`.
SHELL := /bin/bash
# Services not needed by the app are skipped to save memory on 8 GB computers.
SUPABASE_EXCLUDE := studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta
API := apps/api

.PHONY: help setup start stop dev dev-api dev-web test test-api test-web test-e2e lint typecheck codegen seed reset update mock status

help: ## Show all commands
	@grep -E '^[a-z0-9-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

setup: ## Check tools, install, start Supabase, migrate + seed, write .env files
	@scripts/setup.sh

start: ## Start everything (Supabase + API + web) at http://localhost:3000
	supabase start -x $(SUPABASE_EXCLUDE)
	@scripts/write-env.sh >/dev/null
	docker compose up -d --build
	@echo "App: http://localhost:3000   API: http://localhost:8000/docs   Email viewer: http://127.0.0.1:54324"

stop: ## Stop everything (your data is kept)
	-docker compose down
	supabase stop

mock: ## Start with mock AI only (for low-power computers). Same as start in M1.
	@sed -i.bak -E 's/^(STT|PRONUNCIATION|FLUENCY|TTS|GRAMMAR|EMBEDDER|LLM)_PROVIDER=.*/\1_PROVIDER=mock/' .env && rm -f .env.bak
	$(MAKE) start

dev: ## Developer mode: Supabase + API and web with hot reload (no Docker build)
	supabase start -x $(SUPABASE_EXCLUDE)
	@scripts/write-env.sh >/dev/null
	@trap 'kill 0' EXIT; (cd $(API) && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) & pnpm --filter web dev

test: test-api test-web test-e2e ## Run all tests (needs Supabase running for API + e2e)

test-api: ## Backend tests (unit + integration)
	cd $(API) && REQUIRE_DB=1 uv run pytest -q

test-web: ## Frontend unit tests
	pnpm --filter web test --silent

test-e2e: ## End-to-end tests (the app must be running: make start or make dev)
	pnpm --filter e2e test

lint: ## Lint backend and frontend
	cd $(API) && uv run ruff check . && uv run ruff format --check .
	pnpm --filter web lint

typecheck: ## Type-check backend and frontend
	cd $(API) && uv run mypy app
	pnpm --filter web typecheck

codegen: ## Regenerate GraphQL + OpenAPI types for the frontend
	cd $(API) && uv run python -m app.export_contracts ../web/src
	pnpm --filter web codegen

seed: ## Rebuild supabase/seed.sql from content/
	python3 scripts/build_seed.py

reset: ## DELETE all local data and start fresh (asks first)
	@read -r -p "This deletes ALL local accounts, progress and recordings. Type 'yes' to continue: " ans; \
	if [ "$$ans" = "yes" ]; then supabase db reset; echo "All local data was reset."; else echo "Cancelled."; fi

update: ## Get the latest version and apply new migrations (keeps your data)
	git pull --ff-only
	pnpm install --frozen-lockfile
	cd $(API) && uv sync --frozen
	supabase migration up
	docker compose up -d --build

status: ## Show local service URLs
	supabase status
	docker compose ps
