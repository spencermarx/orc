.PHONY: build test lint clean install dev help

# ─── Default ──────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Top-level (all delegate to NX for caching) ─────────────────────────────

build: ## Build all artifacts (via NX)
	@pnpm exec nx run-many -t build

test: ## Run all tests (via NX)
	@pnpm exec nx run-many -t test

lint: ## Lint everything (via NX)
	@pnpm exec nx run-many -t lint

install: ## First-time setup (symlink orc, install commands, build TUI)
	@bash packages/cli/lib/init.sh

clean: ## Remove build artifacts
	@rm -f packages/tui/orc-tui
	@echo "Cleaned."

dev: build ## Build and launch TUI
	@./packages/tui/orc-tui
