.PHONY: build test lint clean install dev help \
       build-tui test-tui test-cli lint-tui lint-cli \
       test-all lint-all

# ─── Default ──────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Top-level ────────────────────────────────────────────────────────────────

build: build-tui ## Build all artifacts

test: test-tui test-cli ## Run all tests

lint: lint-tui lint-cli ## Lint everything

install: ## First-time setup (symlink orc, install commands, build TUI)
	@bash packages/cli/lib/init.sh

clean: ## Remove build artifacts
	@rm -f packages/tui/orc-tui
	@echo "Cleaned."

# ─── TUI (Go) ────────────────────────────────────────────────────────────────

build-tui: ## Build TUI binary
	@cd packages/tui && go build -o orc-tui ./cmd/orc-tui/
	@echo "Built packages/tui/orc-tui"

test-tui: ## Run TUI tests
	@cd packages/tui && go test ./...

lint-tui: ## Vet TUI code
	@cd packages/tui && go vet ./...

dev: build-tui ## Build and launch TUI
	@./packages/tui/orc-tui

# ─── CLI (Bash) ───────────────────────────────────────────────────────────────

test-cli: ## Run CLI tests (requires bats)
	@command -v bats >/dev/null 2>&1 \
		&& cd packages/cli && bats tests/ \
		|| echo "SKIP: bats not installed (brew install bats-core)"

lint-cli: ## Syntax-check CLI scripts
	@bash -n packages/cli/lib/_common.sh
	@bash -n packages/cli/bin/orc
	@echo "CLI syntax OK"

# ─── NX (if you prefer) ──────────────────────────────────────────────────────

nx-test: ## Run tests via NX (with caching)
	@pnpm exec nx run-many -t test

nx-build: ## Build via NX (with caching)
	@pnpm exec nx run-many -t build

nx-lint: ## Lint via NX (with caching)
	@pnpm exec nx run-many -t lint
