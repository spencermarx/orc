# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->


# Migration Changelog

After modifying orc's config schema (`config.toml`, `doctor.sh`), CLI commands, or persona files, update `migrations/CHANGELOG.md`. Entry format instructions are in the HTML comment at the top of that file.

## What Orc Is

Orc is a lightweight SDLC framework for AI coding agents. It orchestrates the full software development lifecycle — **plan, build, review, deliver** — across multiple projects, adapted to each project's tools and workflow. Every lifecycle phase is a configurable hook: users specify *what tool to use* and *when to involve them*, expressed as natural language interpreted by agents.

It uses **tmux** for session management, **git worktrees** for isolation, **Beads** (Dolt-backed) for work tracking, and **markdown** for agent behavior. Planning tools (OpenSpec, Kiro, design docs) plug in via `plan_creation_instructions`. Review tools plug in via `review_instructions`. Delivery pipelines are described in `on_completion_instructions`. The coding work is performed by agentic CLIs (Claude Code, OpenCode, Codex, etc.) running in isolated worktrees.

Core philosophy: shell over runtime, markdown is the control plane, beads are the only state, propose don't act.

## Architecture

Four-tier agent hierarchy:

1. **Root Orchestrator** — conversational session coordinating across projects. Optional; skip with `orc <project>` for single-project work.
2. **Project Orchestrator** — receives user requests, decomposes them into goals, dispatches goal orchestrators, monitors goal-level progress. Never writes code or manages engineers directly.
3. **Goal Orchestrator** — owns one goal (feature/bug/task). Runs in a dedicated git worktree checked out to the goal branch. Spawns a planner to decompose the goal into beads, dispatches engineers, manages the review loop, fast-forward merges approved beads to the goal branch, and handles delivery.
4. **Engineers** — autonomous agent sessions in isolated git worktrees, each assigned a single bead.

Ephemeral sub-agents: **Planner** (decomposes goals into beads during planning), **Configurator** (guides project config setup via `orc setup`), **Reviewer** (reviews bead output).

### Branch Topology

Each goal gets a dedicated branch using configurable type-based prefixes (`feat/`, `fix/`, `task/`). Bead worktrees branch from the goal branch. Approved beads fast-forward merge back into the goal branch. The system never merges to main unless the user explicitly requests it.

```
main ──────────────────────────────────────────→
  └── fix/auth-bug ────────────────────────────→
        ├── work/auth-bug/bd-a1b2 → ff-merge
        └── work/auth-bug/bd-c3d4 → ff-merge
                                        ↓
                                  User reviews or PR
```

### Delivery

Two modes when a goal completes:
- **Configured delivery** (`on_completion_instructions` set): Goal orchestrator executes the delivery pipeline directly — push, PR, ticket updates, etc.
- **Manual review** (default, `on_completion_instructions` empty): Goal branch is presented for user inspection.

State model uses exactly three primitives: **Beads** (Dolt DB at `{project}/.beads/`), **`.worker-status`** (plain text signal per worktree), and **`.worker-feedback`** (review output per worktree).

## Project Structure

```
orc/
├── assets/
│   └── orc-ascii.txt                # ASCII art
├── config.toml                      # Committed defaults
├── config.local.toml                # User overrides (gitignored)
├── projects.toml                    # Project registry (gitignored)
├── migrations/
│   └── CHANGELOG.md                 # Migration guide (all versions)
├── packages/
│   ├── cli/                         # The `orc` command (bash scripts)
│   │   ├── bin/orc                  # Entry point (positional routing)
│   │   └── lib/                     # Subcommand scripts + _common.sh
│   │       ├── adapters/            # Per-CLI adapters (claude.sh, codex.sh, etc.)
│   │       ├── doctor.sh            # Config validation and migration
│   │       ├── notify.sh            # Notification viewer
│   │       └── setup.sh             # Guided project config setup
│   ├── commands/                    # Slash commands for agent CLIs
│   │   ├── _canonical/              # Single-source command definitions (all CLIs)
│   │   ├── claude/orc/              # Legacy Claude commands (symlinked)
│   │   └── windsurf/                # Legacy Windsurf commands (symlinked)
│   └── personas/                    # Default persona markdown files
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── goal-orchestrator.md
│       ├── engineer.md
│       ├── reviewer.md
│       ├── planner.md
│       └── configurator.md
└── openspec/                        # Change proposals and specifications
```

Registered projects get an optional `.orc/` dir for overrides, `.beads/` for state, and `.worktrees/` (gitignored) for engineer workspaces.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Monorepo | NX (integrated mode) |
| Package Manager | pnpm |
| CLI | Pure bash scripts (no build step) |
| Personas | Pure markdown (no runtime dependencies) |
| Slash commands | Markdown (installed via symlinks) |
| Work tracking | Beads (Dolt database, MySQL-compatible) |
| Board visualization | Configurable (Abacus, etc.) with built-in fallback |
| Session management | tmux |
| Agent adapter | Sourced-script adapters per CLI (`packages/cli/lib/adapters/`) |
| Delivery | `gh` CLI for PR creation (optional) |

## Build & Development Commands

```bash
# Setup
git clone https://github.com/thefinalsource/orc.git
cd orc && pnpm install
pnpm orc:install              # Symlinks `orc` to PATH, creates config, installs commands

# CLI (no build step — bash scripts)
# Edit scripts directly in packages/cli/lib/

# Personas (no build step — markdown)
# Edit directly in packages/personas/
```

## CLI Commands

### Navigation (positional arguments)

```bash
orc                            # Root orchestrator (create or attach)
orc <project>                  # Project orchestrator (create or attach)
orc <project> <bead>           # Attach to worktree (engineering plane)
```

### Admin (explicit subcommands)

```bash
orc init                       # First-time setup + install slash commands
orc add <key> <path>           # Register project + install commands
orc remove <key>               # Unregister a project
orc list                       # Show registered projects
orc status                     # Dashboard: projects, goals, workers (goal-grouped)
orc halt <project> <bead>      # Stop an engineer
orc teardown [project] [bead]  # Hierarchical cleanup (bead, project, or all)
orc config [project]           # Open config in $EDITOR
orc board <project>            # Open board view
orc leave                      # Detach from tmux
orc doctor [--fix|--interactive]  # Validate config, fix renames, or interactive migration
orc notify [--all|--clear|--goto N]  # View and navigate notifications
orc setup <project>            # Guided project config setup
```

### Internal (still work, hidden from help)

```bash
orc spawn <project> <bead>     # Create worktree + launch engineer
orc spawn-goal <project> <goal> # Launch goal orchestrator
orc review <project> <bead>    # Launch review pane in worktree
```

Exit codes: `0` success, `1` usage error, `2` state error, `3` project not found.

## Slash Commands (installed per agent CLI)

| Command | Role | Workflow |
|---------|------|----------|
| `/orc` | Any | Orientation: your role, available commands, state |
| `/orc:status` | Any | Run `orc status`, highlight actionable items |
| `/orc:plan` | Project Orch | Decompose request into goals with named branches |
| `/orc:dispatch` | Project/Goal Orch | Spawn goal orchestrators or engineers for ready beads |
| `/orc:check` | Project/Goal Orch | Poll status → handle review/blocked/found/dead |
| `/orc:complete-goal` | Goal Orch | Trigger delivery when all beads and goal-level review are complete |
| `/orc:view` | Orchestrator | Create/adjust tmux layouts for monitoring |
| `/orc:done` | Engineer | Self-review → signal review → STOP |
| `/orc:blocked` | Engineer | Signal blocked with reason → STOP |
| `/orc:feedback` | Engineer | Read .worker-feedback → fix → re-signal → STOP |
| `/orc:leave` | Any | Report state → detach from tmux |

Commands are installed by `orc init` (into orc repo), `orc add` (into projects), and `orc spawn` (into worktrees).

## Configuration

Resolution order (most specific wins): `{project}/.orc/config.toml` > `config.local.toml` > `config.toml`

Key config sections:

```toml
[branching]
strategy = ""                  # Natural language branch naming preference
                               # Default: feat/, fix/, task/ + ticket prefix if available

[worktree]
setup_instructions = ""        # Project-specific bootstrapping for new worktrees
                               # e.g., "Run pnpm install. Copy .env from {project_root}."

[planning.goal]
plan_creation_instructions = ""
bead_creation_instructions = ""
when_to_involve_user_in_plan = ""

[dispatch.goal]
assignment_instructions = ""

[approval]
ask_before_dispatching = "ask"
ask_before_reviewing = "auto"
ask_before_merging = "ask"

[delivery.goal]
on_completion_instructions = ""
when_to_involve_user_in_delivery = ""

[notifications]
system = false
sound = false

[updates]
check_on_launch = true
```

The goal orchestrator uses `/orc:complete-goal` which reads delivery settings.

Persona resolution: `{project}/.orc/{role}.md` > `{orc-repo}/packages/personas/{role}.md`

Project personas are ADDITIVE — they layer on top of CLAUDE.md, .claude/ rules, and existing AI config.

## Prerequisites

`bd` (Beads), `tmux` (3.0+), `git`, `bash` (3.2+), an agent CLI (`claude`/`opencode`/`codex`).

## Code Conventions

- **Shell over runtime**: if bash can do it, don't write TypeScript
- **Markdown is the control plane**: agent behavior lives in `.md` files, not application code
- Conventional commits: `<type>(<scope>): <description>` (feat, fix, docs, style, refactor, test, chore)
- TypeScript (where used): strict mode, ESM only, `type` over `interface`, no `any`, exhaustive switch with `never` default
- Naming: kebab-case files, camelCase identifiers, kebab-case commands
- Testing: Detroit school — test observable behavior, use real dependencies, mock only external systems
- **Cross-OS**: no `readlink -f`, no `grep -P`, portable `mktemp`, `$OSTYPE` for sed -i

## The Review Loop

Two-plane model: each worktree window has an engineering pane (persistent) and a review pane (ephemeral, right side, 40%). Engineers signal `review` via `.worker-status` → goal orchestrator creates review pane → reviewer writes verdict to `.worker-feedback` → if approved, bead is fast-forward merged to goal branch and worktree is torn down → if not approved, review pane destroyed, engineer gets feedback and re-signals → repeats up to `max_rounds` (default 3) then escalates to human.

Review mode is configurable via `[review.dev]` (bead-level) and `[review.goal]` (goal-level) config sections with `review_instructions` fields.

## Approval Policy

Three configurable gates: `ask_before_dispatching`, `ask_before_reviewing`, `ask_before_merging`. Each can be `"ask"` (human confirms) or `"auto"` (orchestrator proceeds). Defaults: ask_before_dispatching=ask, ask_before_reviewing=auto, ask_before_merging=ask. Always escalates on: blocked engineers, max review rounds, merge conflicts, out-of-scope discoveries.

Delivery is controlled via `[delivery.goal] on_completion_instructions`. When set, the goal orchestrator executes the delivery pipeline (push, PR, etc.). When empty (default), the goal branch is presented for user inspection. The system never merges to the project's main/default branch unless the user explicitly requests it.

## tmux Layout

All agents in one tmux session (`orc`). Each goal gets its own window with the goal orchestrator as pane 0 (left/main) and engineers splitting in on the right:

```
orc                              ← Root orchestrator (window)
status                           ← Dashboard (window)
{project}                        ← Project orchestrator (window)
{project}/{goal}                 ← Goal window (main-vertical layout)
  ├── pane 0: Goal orchestrator   (title: "goal: <name>", persistent, left ~60%)
  ├── pane N: Engineer            (title: "eng: <bead>", right column)
  ├── pane N+1: Engineer          (title: "eng: <bead>", right column)
  └── pane N+2: Reviewer          (title: "review: ...", ephemeral, splits vertically below its eng pane)
{project}/board                  ← Board view (window)
```

### Pane Overflow

When a window cannot fit another pane (below `layout.min_pane_width` or `layout.min_pane_height` thresholds), the system creates overflow windows with a `:N` suffix (e.g., `{project}:2`, `{project}/{goal}:2`). Teardown cleans up overflow windows automatically.

### Pane Navigation

Panes are identified by their titles (`goal: <name>`, `eng: <bead>`, `review: <project>/<bead>`). Use `tmux list-panes -t orc:<window> -F '#{pane_index}:#{pane_title}'` to find specific panes. The review pane splits vertically below its engineer pane (40% height) and is destroyed after each review round.

### Layout Configuration

```toml
[layout]
min_pane_width = 40    # Minimum columns before overflow
min_pane_height = 10   # Minimum rows before overflow
```

Status bar shows aggregate health (goal count + worker states). Window names are stable identifiers — status indicators (● ✓ ✗) are rendered via `@orc_status` user option in the window-status-format, not embedded in names. Pane borders show titles. Activity monitoring highlights active windows. The `orc status` dashboard groups workers under their parent goal for hierarchical visibility.

<!-- OCR:START -->
# Open Code Review Instructions

These instructions are for AI assistants handling code review in this project.

Always open `.ocr/skills/SKILL.md` when the request:
- Asks for code review, PR review, or feedback on changes
- Mentions "review my code" or similar phrases
- Wants multi-perspective analysis of code quality
- Asks to map, organize, or navigate a large changeset

Use `.ocr/skills/SKILL.md` to learn:
- How to run the 8-phase review workflow
- How to generate a Code Review Map for large changesets
- Available reviewer personas and their focus areas
- Session management and output format

Keep this managed block so 'ocr init' can refresh the instructions.

<!-- OCR:END -->
