# Development Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Hub TUI runtime |
| pnpm | 9+ | Package manager |
| tmux | 3.0+ | Terminal multiplexing |
| bash | 3.2+ | CLI scripts |
| git | 2.20+ | Worktree management |

Optional: `bd` (Beads CLI) for bead DB, `claude`/`opencode`/`codex`/`gemini` for agent CLIs.

## Setup

```bash
git clone https://github.com/thefinalsource/orc.git
cd orc
pnpm install        # Install all dependencies
pnpm build          # Build all packages (Hub TypeScript → dist/)
pnpm orc:install    # Symlink `orc` to PATH, install slash commands
```

## Repository Structure

```
orc/
├── packages/
│   ├── cli/          # The `orc` command — pure bash (no build step)
│   │   ├── bin/orc   # Entry point
│   │   └── lib/      # Subcommands, helpers, adapters
│   ├── hub/          # Hub sidebar TUI — TypeScript + Ink/React
│   │   ├── src/      # Source (components, lib, tests)
│   │   ├── dist/     # Compiled output (gitignored)
│   │   └── bin/      # Entry point wrapper
│   ├── commands/     # Slash commands for agent CLIs (markdown)
│   └── personas/     # Default persona files (markdown)
├── config.toml       # Committed defaults
├── nx.json           # NX workspace config
├── openspec/         # Change proposals and specs
└── docs/             # Documentation
```

## Build System

The monorepo uses **NX** (integrated mode) with **pnpm** workspaces. NX infers targets from `package.json` scripts — no `project.json` files needed.

### NX Targets

```bash
# Build
nx build @orc/hub           # Build Hub (tsc → dist/)
pnpm build                   # Build all packages
pnpm build:hub               # Shorthand for Hub

# Test
nx test @orc/hub             # Run Hub tests (22 automated)
pnpm test                    # Test all packages
pnpm test:hub                # Shorthand for Hub

# Type check
nx typecheck @orc/hub        # Type-check without emit

# Run all
nx run-many --target=build   # Build everything
nx run-many --target=test    # Test everything
```

NX caches build and test results. If source files haven't changed, subsequent runs are instant.

### Hub Development Workflow

```bash
# 1. Start the build watcher
cd packages/hub
pnpm dev                     # tsc --watch

# 2. In another terminal, test manually
node bin/orc-hub.js                    # Standalone TUI (no tmux needed)
node bin/orc-hub.js --status-line      # One-line status output
node bin/orc-hub.js --window=myapp     # Simulate project-level view

# 3. Run tests
pnpm test:hub                # or: nx test @orc/hub
```

## Testing

### Automated Tests

Hub tests use Node's native test runner (`node:test`):

```bash
nx test @orc/hub

# Or run specific test files:
node --test dist/__tests__/config.test.js
node --test dist/__tests__/state.test.js
node --test dist/__tests__/api.test.js
```

| Test file | Tests | What it covers |
|-----------|-------|----------------|
| `config.test.ts` | 5 | Config resolution chain, defaults, overrides |
| `state.test.ts` | 11 | Project scanning, status parsing, phases, elapsed time |
| `api.test.ts` | 6 | HTTP API endpoints (status, progress, log, notify, state) |

### Manual E2E Tests

See `packages/hub/E2E_TEST_PLAN.md` for 18 manual test scenarios covering:
- Hub launch and sidebar rendering
- Tree navigation and drill-down
- Agent focus and Ctrl-o return
- Header pane creation and state-aware coloring
- Approve/reject actions
- Copilot view
- Attach/detach/reattach
- Terminal resize
- 5+ concurrent agents

### Running E2E Tests

```bash
# 1. Enable Hub
echo '[hub]\nenabled = true' >> config.local.toml

# 2. Register a test project
orc add myproject /path/to/project

# 3. Launch orc
orc

# 4. Follow E2E_TEST_PLAN.md scenarios
```

## Package Development

### CLI (Bash)

Edit scripts directly in `packages/cli/lib/`. No build step. Changes take effect immediately.

Key files:
- `_common.sh` — Shared helpers, tmux abstraction, theme, keybindings
- `start.sh` — Session initialization, Hub launch
- `spawn.sh` / `spawn-goal.sh` — Agent pane creation
- `teardown.sh` — Cleanup
- `header.sh` — Agent header pane renderer

### Hub (TypeScript)

Source in `packages/hub/src/`. Build with `pnpm build:hub` or `nx build @orc/hub`.

Key files:
- `src/App.tsx` — Main Hub application (state, navigation, actions)
- `src/components/` — React/Ink components (TreeView, ActivityFeed, etc.)
- `src/lib/config.ts` — Config reader (TOML resolution chain)
- `src/lib/state.ts` — Orchestration state from file watchers
- `src/lib/tmux.ts` — tmux CLI integration
- `src/lib/api.ts` — HTTP API server

### Personas (Markdown)

Edit directly in `packages/personas/`. No build step.

### Slash Commands (Markdown)

Edit canonical definitions in `packages/commands/_canonical/`. CLI-specific symlinks are created by `orc init` and `orc add`.

## Code Conventions

- **Shell over runtime** — if bash can do it, don't write TypeScript
- **Markdown is the control plane** — agent behavior lives in `.md` files
- **Conventional commits** — `<type>(<scope>): <description>` (feat, fix, docs, chore, refactor)
- **TypeScript** — strict mode, ESM only, `type` over `interface`
- **Naming** — kebab-case files, camelCase identifiers
- **Cross-OS** — no `readlink -f`, no `grep -P`, portable `mktemp`

## Config Changes

After modifying config schema (`config.toml`, `doctor.sh`), CLI commands, or persona files, update `migrations/CHANGELOG.md` per the format instructions at the top of that file.
