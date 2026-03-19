<p align="center">
  <img src="assets/orc-ascii.svg" alt="orc" width="480" />
</p>

<h1 align="center">orc</h1>

Lightweight orchestration layer that coordinates AI coding agents across multiple projects.

Uses **tmux** for session management, **git worktrees** for isolation, **Beads** (Dolt-backed) for work tracking, and **markdown** for agent behavior. The coding work is performed by agentic CLIs (Claude Code, OpenCode, Codex, etc.) running in isolated worktrees.

**Core philosophy:** shell over runtime, markdown is the control plane, beads are the only state, propose don't act.

## How It Works

You give orc a list of bugs, features, or tasks. Orc breaks each into a **goal** — a coordinated unit of delivery with its own branch. Each goal is decomposed into **beads** (small, focused work items), and each bead is assigned to an autonomous AI engineer in an isolated git worktree. When all beads are done, the goal branch contains the complete deliverable — ready for you to review or raise as a single PR.

```
"Fix auth bug, add rate limiting, update API docs"
    ↓
┌─────────────────────────────────────────────────────────────┐
│  Goal: fix-auth-bug          branch: fix/auth-bug           │
│    ├── bead: validate-inputs   → engineer in worktree       │
│    └── bead: add-error-handler → engineer in worktree       │
│                                                             │
│  Goal: add-rate-limiting     branch: feat/add-rate-limiting │
│    ├── bead: rate-limiter-middleware → engineer              │
│    ├── bead: config-endpoint        → engineer              │
│    └── bead: rate-limit-tests       → engineer              │
│                                                             │
│  Goal: update-api-docs       branch: task/update-api-docs   │
│    └── bead: update-openapi-spec    → engineer              │
└─────────────────────────────────────────────────────────────┘
    ↓
Each goal branch → user reviews → PR (optional)
```

## Architecture

Four-tier agent hierarchy:

```
Root Orchestrator (cross-project coordination)
  └─→ Project Orchestrator (per project — creates goals, monitors progress)
        └─→ Goal Orchestrator (per goal — owns one feature/bug/task)
              ├─→ Engineers (per bead, in isolated worktrees)
              └─→ Reviewers (ephemeral, per review cycle)
```

| Tier | Responsibility | Never does |
|------|---------------|------------|
| **Root Orchestrator** | Coordinates across projects, routes user requests | Write code, manage beads |
| **Project Orchestrator** | Decomposes requests into goals, dispatches goal orchestrators, monitors goal-level progress | Write code, manage engineers directly |
| **Goal Orchestrator** | Owns one goal: plans beads, dispatches engineers, runs review loop, merges beads to goal branch, handles delivery | Write code, touch other goals |
| **Engineer** | Implements one bead in an isolated worktree | Push, merge, create PRs, modify beads |

### Branch Topology

Each goal gets a dedicated branch. Beads branch from the goal branch (not main). Approved beads fast-forward merge back into the goal branch.

```
main ─────────────────────────────────────────────────────→
  └── fix/auth-bug ───────────────────────────────────────→
        ├── work/auth-bug/bd-a1b2 ──→ ff-merge to fix/auth-bug
        └── work/auth-bug/bd-c3d4 ──→ ff-merge to fix/auth-bug
                                           ↓
                                     User reviews branch
                                     (optional: PR → main)
```

### Branch Naming

Goal branches use type-based prefixes by default:

- `feat/<goal-name>` — features
- `fix/<goal-name>` — bug fixes
- `task/<goal-name>` — general tasks

Ticket prefixes are included when available (e.g., `feat/WEN-123-add-sso`).

Fully configurable via natural language in config:

```toml
[branching]
strategy = "always use Jira ticket prefix like PROJ-123, then kebab-case summary"
```

### Delivery

When all beads under a goal are complete, two delivery modes are available:

**Review (default):** The goal branch is presented for user inspection. The user can provide additional feedback via any agent plane, request changes, or take manual action.

**PR:** When configured or requested, the goal orchestrator pushes the branch and creates a PR via `gh` to a configurable target branch.

```toml
[delivery]
mode = "review"       # "review" (default) or "pr"
target_strategy = ""  # Natural language: "target develop unless hotfix → release branch"
```

The system never merges to main unless you explicitly request it.

### State Model

Three primitives only:

- **Beads** — Dolt DB at `{project}/.beads/`. Single source of truth for work items.
- **`.worker-status`** — Plain text signal per worktree (`working`, `review`, `blocked: <reason>`, `dead`).
- **`.worker-feedback`** — Structured review output written by reviewer agents.

### Review Loop

Two-plane model per worktree: engineering pane (persistent) + review pane (ephemeral, right side, 40%).

1. Engineer signals `review` via `.worker-status`
2. Goal orchestrator launches reviewer in review pane
3. Reviewer writes verdict to `.worker-feedback`
4. If approved → fast-forward merge to goal branch, teardown worktree
5. If not approved → feedback sent to engineer, who addresses and re-signals
6. Repeats up to `max_rounds` (default 3), then escalates to human

## Quick Start

```bash
# Install
git clone https://github.com/thefinalsource/orc.git
cd orc && pnpm install
pnpm orc:install              # Symlinks `orc` to PATH, creates config, installs commands

# Register a project
orc add myapp /path/to/myapp

# Start working
orc myapp                     # Launch project orchestrator
# Then tell it what to build — it handles the rest
```

### Prerequisites

`bd` (Beads), `tmux` (3.0+), `git`, `bash` (4+), an agent CLI (`claude`/`opencode`/`codex`).

## CLI Commands

### Navigation

```bash
orc                            # Root orchestrator (create or attach)
orc <project>                  # Project orchestrator (create or attach)
orc <project> <bead>           # Attach to worktree (engineering plane)
```

### Admin

```bash
orc init                       # First-time setup + install slash commands
orc add <key> <path>           # Register project + install commands
orc remove <key>               # Unregister a project
orc list                       # Show registered projects
orc status                     # Dashboard: all projects, goals, workers
orc halt <project> <bead>      # Stop an engineer
orc teardown [project] [goal] [bead]  # Hierarchical cleanup
orc config [project]           # Open config in $EDITOR
orc board <project>            # Open board view
orc leave                      # Detach from tmux
```

Exit codes: `0` success, `1` usage error, `2` state error, `3` project not found.

## Slash Commands

| Command | Role | Workflow |
|---------|------|----------|
| `/orc` | Any | Orientation: your role, available commands, state |
| `/orc:status` | Any | Run `orc status`, highlight actionable items |
| `/orc:plan` | Project Orch | Decompose request into goals with named branches |
| `/orc:dispatch` | Project/Goal Orch | Spawn goal orchestrators or engineers for ready beads |
| `/orc:check` | Project/Goal Orch | Poll status, handle review/blocked/found/dead |
| `/orc:complete-goal` | Goal Orch | Trigger delivery (review or PR) when all beads done |
| `/orc:view` | Orchestrator | Create/adjust tmux layouts for monitoring |
| `/orc:done` | Engineer | Self-review → signal review → STOP |
| `/orc:blocked` | Engineer | Signal blocked with reason → STOP |
| `/orc:feedback` | Engineer | Read feedback → fix → re-signal → STOP |
| `/orc:leave` | Any | Report state → detach from tmux |

## Configuration

Resolution order (most specific wins): `{project}/.orc/config.toml` > `config.local.toml` > `config.toml`

```toml
# config.toml — key sections

[defaults]
agent_cmd = "claude"           # Agent CLI to use
max_workers = 3                # Max concurrent engineers per goal

[approval]
spawn = "ask"                  # "ask" or "auto"
review = "auto"
merge = "ask"

[branching]
strategy = ""                  # Natural language branch naming preference

[delivery]
mode = "review"                # "review" or "pr"
target_strategy = ""           # Natural language PR target branch strategy

[review]
max_rounds = 3                 # Review rounds before escalating to human
command = ""                   # "" = default reviewer, or custom command
```

Persona resolution: `{project}/.orc/{role}.md` > `{orc-repo}/packages/personas/{role}.md`

## tmux Layout

All agents in one tmux session (`orc`):

```
Session: orc
├── orc                              ← Root orchestrator
├── status                           ← Live dashboard
├── myapp                            ← Project orchestrator
├── myapp/fix-auth                   ← Goal orchestrator (agent plane)
├── myapp/fix-auth/bd-a1b2           ← Engineer (eng + review panes)
├── myapp/fix-auth/bd-c3d4           ← Engineer
├── myapp/add-rate-limit             ← Goal orchestrator
├── myapp/add-rate-limit/bd-e5f6     ← Engineer
├── myapp/board                      ← Board view
└── api                              ← Another project orchestrator
```

Status bar shows aggregate health. Window names include status indicators (● working, ✓ review, ✗ blocked). Pane borders show titles.

## Project Structure

```
orc/
├── config.toml                      # Committed defaults
├── config.local.toml                # User overrides (gitignored)
├── projects.toml                    # Project registry (gitignored)
├── packages/
│   ├── cli/                         # The `orc` command (bash scripts)
│   │   ├── bin/orc                  # Entry point (positional routing)
│   │   └── lib/                     # Subcommand scripts + _common.sh
│   ├── commands/                    # Slash commands for agent CLIs
│   │   ├── claude/orc/              # Claude Code commands
│   │   └── windsurf/                # Windsurf commands
│   └── personas/                    # Default persona markdown files
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── goal-orchestrator.md
│       ├── engineer.md
│       └── reviewer.md
├── docs/
└── examples/
```

## License

See [LICENSE](LICENSE) for details.
