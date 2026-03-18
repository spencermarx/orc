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

Three-tier hierarchy:

1. **Root Orchestrator** — conversational session coordinating across projects. Optional; skip with `orc start <project>` for single-project work.
2. **Project Orchestrator** — runs at project root, decomposes goals into beads, sequences/dispatches engineers, manages the review loop.
3. **Engineers** — autonomous agent sessions in isolated git worktrees. Each gets a single bead assignment via `.orch-assignment.md`.

State model uses exactly three primitives: **Beads** (Dolt DB at `{project}/.beads/`), **`.worker-status`** (plain text signal per worktree), and **`.worker-feedback`** (review output per worktree).

## Project Structure

```
orc/
├── config.toml                    # Committed defaults
├── config.local.toml              # User overrides (gitignored)
├── projects.toml                  # Project registry (gitignored)
├── nx.json / package.json / pnpm-workspace.yaml
├── packages/
│   ├── cli/                       # The `orc` command (bash scripts)
│   │   ├── bin/orc                # Entry point (symlinked to PATH)
│   │   └── lib/                   # Subcommand scripts + _common.sh
│   └── personas/                  # Default persona markdown files
│       ├── root-orchestrator.md
│       ├── orchestrator.md
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
| Work tracking | Beads (Dolt database, MySQL-compatible) |
| Board visualization | Abacus (default), configurable |
| Session management | tmux |
| Agent adapter | String interpolation (`$AGENT_CMD $AGENT_FLAGS --print "$INITIAL_PROMPT"`) |

## Build & Development Commands

```bash
# Setup
git clone https://github.com/thefinalsource/orc.git
cd orc && pnpm install
pnpm orc:install              # Symlinks `orc` to PATH, creates gitignored config files

# CLI (no build step — bash scripts)
# Edit scripts directly in packages/cli/lib/

# Personas (no build step — markdown)
# Edit directly in packages/personas/
```

## CLI Commands

```bash
orc                            # Help + brief status
orc init                       # First-time setup
orc add <key> <path>           # Register a project
orc remove <key>               # Unregister a project
orc list                       # Show registered projects
orc start                      # Start root orchestrator
orc start <project>            # Start project orchestrator
orc spawn <project> <bead>     # Create worktree + launch engineer
orc review <project> <bead>    # Trigger review for a worktree
orc board <project>            # Open Abacus (or configured board)
orc status                     # Dashboard: all projects, all workers
orc halt <project> <bead>      # Stop an engineer
orc teardown <project> <bead>  # Remove worktree + clean up branch
orc config                     # Open config in $EDITOR
orc config <project>           # Open project config in $EDITOR
```

Exit codes: `0` success, `1` usage error, `2` state error, `3` project not found.

## Configuration

Resolution order (most specific wins): `{project}/.orc/config.toml` > `config.local.toml` > `config.toml`

Persona resolution: `{project}/.orc/{role}.md` > `{orc-repo}/packages/personas/{role}.md`

Project personas are ADDITIVE — they layer on top of CLAUDE.md, .claude/ rules, and existing AI config.

## Prerequisites

`bd` (Beads), `tmux`, `git`, an agent CLI (`claude`/`opencode`/`codex`). Recommended: `abacus`.

## Code Conventions

- **Shell over runtime**: if bash can do it, don't write TypeScript
- **Markdown is the control plane**: agent behavior lives in `.md` files, not application code
- Conventional commits: `<type>(<scope>): <description>` (feat, fix, docs, style, refactor, test, chore)
- TypeScript (where used): strict mode, ESM only, `type` over `interface`, no `any`, exhaustive switch with `never` default
- Naming: kebab-case files, camelCase identifiers, kebab-case commands
- Testing: Detroit school — test observable behavior, use real dependencies, mock only external systems

## The Review Loop

Engineers signal `review` via `.worker-status` → orchestrator spawns a review agent in the worktree → reviewer writes verdict to `.worker-feedback` → if not approved, engineer gets structured feedback and re-signals → repeats up to `max_rounds` (default 3) then escalates to human.

Review is an agent session with full access to project AI config, slash commands, skills, OCR, test suite, and linters. Verdicts are LLM-classified, not regex-matched.

## Approval Policy

Three configurable gates: `spawn`, `review`, `merge`. Each can be `"ask"` (human confirms) or `"auto"` (orchestrator proceeds). Defaults: spawn=ask, review=auto, merge=ask. Always escalates on: blocked engineers, max review rounds, merge conflicts, out-of-scope discoveries.

## tmux Layout

All agents in one tmux session (`orc`). Windows: `orc` (root), `dash` (status), `{project}` (orchestrator), `{project}/{bead}` (engineer), `{project}/board` (Abacus).
