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

## What Orc Is

Orc is a lightweight orchestration layer that coordinates AI coding agents across multiple projects. It uses **tmux** for session management, **git worktrees** for isolation, **Beads** (Dolt-backed) for work tracking, and **markdown** for agent behavior. The coding work is performed by agentic CLIs (Claude Code, OpenCode, Codex, etc.) running in isolated worktrees.

Core philosophy: shell over runtime, markdown is the control plane, beads are the only state, propose don't act.

## Architecture

Four-tier agent hierarchy:

1. **Root Orchestrator** — conversational session coordinating across projects. Optional; skip with `orc <project>` for single-project work.
2. **Project Orchestrator** — receives user requests, decomposes them into goals, dispatches goal orchestrators, monitors goal-level progress. Never writes code or manages engineers directly.
3. **Goal Orchestrator** — owns one goal (feature/bug/task). Runs as a separate agent session. Decomposes the goal into beads, dispatches engineers, manages the review loop, fast-forward merges approved beads to the goal branch, and handles delivery (review or PR).
4. **Engineers** — autonomous agent sessions in isolated git worktrees, each assigned a single bead.

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
- **Review (default):** Goal branch is presented for user inspection. User can provide feedback via any agent plane.
- **PR:** Goal orchestrator pushes and creates PR via `gh` to a configurable target branch.

State model uses exactly three primitives: **Beads** (Dolt DB at `{project}/.beads/`), **`.worker-status`** (plain text signal per worktree), and **`.worker-feedback`** (review output per worktree).

## Project Structure

```
orc/
├── assets/
│   └── orc-ascii.txt                # ASCII art
├── config.toml                      # Committed defaults
├── config.local.toml                # User overrides (gitignored)
├── projects.toml                    # Project registry (gitignored)
├── packages/
│   ├── cli/                         # The `orc` command (bash scripts)
│   │   ├── bin/orc                  # Entry point (positional routing)
│   │   └── lib/                     # Subcommand scripts + _common.sh
│   ├── commands/                    # Slash commands for agent CLIs
│   │   ├── claude/orc/              # Claude Code commands (/orc, /orc:status, etc.)
│   │   └── windsurf/                # Windsurf commands (orc-index, orc-status, etc.)
│   └── personas/                    # Default persona markdown files
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── goal-orchestrator.md
│       ├── engineer.md
│       └── reviewer.md
├── docs/
└── examples/
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
| Agent adapter | String interpolation with --yolo support |
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
orc status                     # Dashboard: all projects, all workers
orc halt <project> <bead>      # Stop an engineer
orc teardown [project] [bead]  # Hierarchical cleanup (bead, project, or all)
orc config [project]           # Open config in $EDITOR
orc board <project>            # Open board view
orc leave                      # Detach from tmux
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
| `/orc:complete-goal` | Goal Orch | Trigger delivery (review or PR) when all beads done |
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

[delivery]
mode = "review"                # "review" (default) or "pr"
target_strategy = ""           # Natural language PR target branch strategy
                               # e.g., "gitflow: target develop, hotfix → release branch"
```

Persona resolution: `{project}/.orc/{role}.md` > `{orc-repo}/packages/personas/{role}.md`

Project personas are ADDITIVE — they layer on top of CLAUDE.md, .claude/ rules, and existing AI config.

## Prerequisites

`bd` (Beads), `tmux` (3.0+), `git`, `bash` (4+), an agent CLI (`claude`/`opencode`/`codex`).

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

Review mode is configurable: default reviewer persona, `/ocr:review`, or custom command via `[review] command` in config.

## Approval Policy

Three configurable gates: `spawn`, `review`, `merge`. Each can be `"ask"` (human confirms) or `"auto"` (orchestrator proceeds). Defaults: spawn=ask, review=auto, merge=ask. Always escalates on: blocked engineers, max review rounds, merge conflicts, out-of-scope discoveries.

Delivery is controlled separately via `[delivery] mode`: `"review"` (default, user inspects goal branch) or `"pr"` (push + create PR via `gh`). The system never merges to the project's main/default branch unless the user explicitly requests it.

## tmux Layout

All agents in one tmux session (`orc`). Three-level window hierarchy:

```
orc                              ← Root orchestrator
status                           ← Dashboard
{project}                        ← Project orchestrator
{project}/{goal}                 ← Goal orchestrator (agent plane)
{project}/{goal}/{bead}          ← Engineer worktree (eng + review panes)
{project}/board                  ← Board view
```

Status bar shows aggregate health. Window names include live status indicators (● ✓ ✗). Pane borders show titles. Activity monitoring highlights active windows.
