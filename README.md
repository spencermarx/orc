<p align="center">
  <img src="assets/orc-ascii.svg" alt="orc" width="480" />
</p>

<h1 align="center">orc</h1>

<p align="center">
  <strong>Command a horde of AI coding agents across your projects.</strong>
  <br />
  <em>You give orders. They build. Nobody steps on each other's toes.</em>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/get_started-5_minutes-00ff88?style=flat-square" alt="Get Started" /></a>
  <a href="#configuration"><img src="https://img.shields.io/badge/config-TOML-8b949e?style=flat-square" alt="Config" /></a>
  <img src="https://img.shields.io/badge/runtime-bash_4+-d29922?style=flat-square" alt="Bash 4+" />
  <img src="https://img.shields.io/badge/build_step-none-30363d?style=flat-square" alt="No Build Step" />
  <img src="https://img.shields.io/badge/framework_lock--in-zero-30363d?style=flat-square" alt="No Lock-in" />
</p>

<br />

> **orc** */ork/* — a creature known for strength in numbers, brutal efficiency, and an unwavering commitment to getting the job done. Also: an **orc**hestration layer for AI agents. Coincidence? Absolutely not.

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [Why Orc?](#why-orc)
- [The 30-Second Version](#the-30-second-version)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [CLI Reference](#cli-reference)
- [Slash Commands](#slash-commands)
- [Configuration](#configuration)
- [YOLO Mode](#yolo-mode)
- [Review Loop](#review-loop)
- [Customizing Personas](#customizing-personas)
- [tmux Layout](#tmux-layout)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

</details>

---

## Why Orc?

You have a big feature request. You could have five AI engineers working on it in parallel — but who coordinates them? Who keeps them from trampling each other's files? Who reviews their work before it hits your branch?

Orc does.

- **Automatic decomposition** — describe what you want; orc breaks it into goals and beads (focused work items), no manual ticket-writing required
- **Isolated worktrees** — every engineer gets its own git worktree — zero conflicts, zero coordination headaches
- **Built-in review loop** — every piece of work is reviewed before merge, so bugs don't sneak past the front lines
- **One clean branch** — you review a single goal branch, not 10 scattered PRs from 10 scattered agents

Orc runs on tmux, git, and plain markdown. It works with any agentic CLI — [Claude Code](https://docs.anthropic.com/en/docs/claude-code), OpenCode, Codex, or your own. No daemon, no server, no framework.

## The 30-Second Version

```
  "Fix auth, add rate limiting, update docs"
                    │
                    ▼
            ┌──── orc ────┐                     You describe the work.
            │      │      │
            ▼      ▼      ▼
      fix/auth  feat/rate  task/docs             Orc creates goal branches.
        │   │      │         │
        ▼   ▼      ▼         ▼
       ┌─┐ ┌─┐   ┌─┐       ┌─┐
       │E│ │E│   │E│       │E│               Engineers work in parallel,
       └┬┘ └┬┘   └┬┘       └┬┘               each in an isolated worktree.
        │   │      │         │
        ▼   ▼      ▼         ▼
       ✓/✗ ✓/✗    ✓/✗       ✓/✗                 Built-in review loop.
        │   │      │         │
        ▼   ▼      ▼         ▼
      fix/auth  feat/rate  task/docs             Approved beads merge
        │          │         │                   back to goal branches.
        ▼          ▼         ▼
          You review & merge                     You decide when to ship.
```

## Quick Start

### 1. Install Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [Beads](https://github.com/thefinalsource/beads) (`bd`) | Work tracking (Dolt-backed) | See Beads repo |
| [tmux](https://github.com/tmux/tmux) 3.0+ | Session management | `brew install tmux` / `apt install tmux` |
| `git` | Worktrees and branching | Pre-installed on most systems |
| `bash` 4+ | CLI runtime | `brew install bash` (macOS ships 3.x) |
| Agent CLI | Your AI coding agents | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), OpenCode, or Codex |

Optional: [`gh`](https://cli.github.com/) — only needed if you want orc to auto-create PRs.

### 2. Install Orc

```bash
git clone https://github.com/thefinalsource/orc.git
cd orc && pnpm install
pnpm orc:install
```

> This symlinks `orc` to your PATH, creates config files, and installs slash commands for your agent CLI.

### 3. Register Your Project

```bash
orc add myapp /path/to/myapp
```

### 4. Launch

```bash
orc myapp
```

> A tmux session opens with a project orchestrator. Tell it what to build — it investigates your codebase, plans the work, spawns engineers, runs reviews, and delivers clean goal branches. You approve when ready.

### 5. Go Full Send (Optional)

```bash
orc myapp --yolo      # No confirmation prompts. Full autonomy.
```

## Usage

Once orc is installed and your projects are registered, here's how you actually use it day-to-day.

### Multi-Project Orchestration

Launch the root orchestrator to coordinate work across multiple projects at once:

```bash
orc
```

Then tell it what you need:

```
> Refactor the auth module in the API project, then update the frontend
> to use the new auth endpoints. The docs site needs updated examples too.
```

The root orchestrator routes each piece to the right project orchestrator. You stay in one place while work fans out across projects.

### Single-Project Orchestration

Most of the time you're working on one project. Jump straight to it:

```bash
orc myapp
```

Then describe the work:

```
> Add rate limiting to all public API endpoints. Use Redis for the
> token bucket. Add integration tests and update the OpenAPI spec.
```

The project orchestrator decomposes this into goals, creates goal branches, spawns goal orchestrators, and dispatches engineers — all while you watch (or go get coffee).

### Jumping Into a Worktree

You're not locked out of the lower tiers. You can attach to any engineer's worktree and interact with them directly:

```bash
orc myapp bd-a1b2       # Attach to a specific engineer's tmux pane
```

From there you can:
- **Give the engineer additional context** — paste error logs, clarify requirements, point to specific files
- **Take over entirely** — start coding in the worktree yourself; the engineer's agent is right there in the pane
- **Provide review feedback** — if you're watching a review pane, you can intervene before the reviewer writes its verdict

This is useful when an engineer is blocked, when you want to pair-program with an agent, or when you just want to see what's happening up close.

### Configuring Custom Review

Every project can define its own review process. In your project's config:

```bash
mkdir -p /path/to/myapp/.orc
```

Create `/path/to/myapp/.orc/config.toml`:

```toml
[review]
# Use a custom review command instead of the default reviewer persona
command = "/ocr:review"

# Or add project-specific guidelines to the default reviewer
instructions = """
Focus on security: check for SQL injection, XSS, and auth bypass.
All new endpoints must have rate limiting.
Verify error responses follow our RFC 7807 format.
"""

# Allow up to 5 review rounds before escalating
max_rounds = 5
```

The `command` field lets you swap in any review tool — the built-in reviewer persona, [OCR](https://github.com/thefinalsource/ocr) multi-agent review, or a custom script. The `instructions` field appends natural language guidelines to whatever reviewer you're using.

### Configuring Branching and Delivery

Control how orc names branches and what happens when a goal is complete:

```toml
# In config.local.toml (global) or {project}/.orc/config.toml (per-project)

[branching]
# Natural language — orc interprets this when creating goal branches
strategy = "use Jira ticket prefix like PROJ-123, then kebab-case summary"

[delivery]
# Automatically push and create PRs when goals complete (instead of manual review)
mode = "pr"

# Natural language — orc interprets this when choosing the PR target branch
target_strategy = "target develop for features, main for hotfixes"
```

With `mode = "pr"`, when all beads in a goal pass review, the goal orchestrator automatically pushes the goal branch and creates a PR via `gh`. You review and merge the PR like any other.

With `mode = "review"` (the default), the goal branch is presented for your inspection in the tmux session. You can provide feedback, request changes, or merge manually.

**Combining with YOLO mode** for a fully hands-off pipeline:

```bash
orc myapp --yolo
# Goals are planned, engineers are dispatched, reviews run automatically,
# and PRs are created — all without confirmation prompts.
# You come back to open PRs ready for your review.
```

## How It Works

You describe what you want. Orc breaks it into **goals** (deliverables with dedicated branches), then into **beads** (small work items for individual engineers). Each engineer runs in an isolated worktree. When all beads pass review, you get a clean goal branch.

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
Each goal branch → you review → merge or PR
```

### Branch Topology

Beads branch from their goal branch (not main). Approved beads fast-forward merge back. The system never touches your main branch unless you say so.

```
main ─────────────────────────────────────────────────────→
  └── fix/auth-bug ───────────────────────────────────────→
        ├── work/auth-bug/bd-a1b2 ──→ ff-merge ──┐
        └── work/auth-bug/bd-c3d4 ──→ ff-merge ──┤
                                                  ↓
                                           fix/auth-bug
                                          (ready to review)
```

## Architecture

Four-tier hierarchy — every level has a clear job and hard boundaries:

```
Root Orchestrator ─── cross-project coordination
  └─→ Project Orchestrator ─── creates goals, monitors progress
        └─→ Goal Orchestrator ─── owns one goal, manages the worktree tier
              └─→ Worktree ─── isolated git worktree per bead
                    ├── Engineer (persistent) ─── implements the bead
                    └── Reviewer (ephemeral) ─── reviews the work
```

| Tier | Responsibility | Never does |
|------|---------------|------------|
| **Root Orchestrator** | Coordinates across projects, routes your requests | Write code, manage beads |
| **Project Orchestrator** | Decomposes requests into goals, dispatches goal orchestrators, monitors progress | Write code, manage engineers directly |
| **Goal Orchestrator** | Owns one goal: plans beads, dispatches engineers, manages the review loop, merges to goal branch | Write code, touch other goals |
| **Worktree** | Each bead gets an isolated worktree with two agents working in a loop managed by the goal orchestrator: | |
| ↳ **Engineer** | Implements the bead (persistent — stays until the bead is done) | Push, merge, create PRs, modify beads |
| ↳ **Reviewer** | Evaluates the engineer's work against acceptance criteria, writes a verdict (ephemeral — spawns per review cycle) | Modify code, change bead state |

Reviewers are fully customizable — use the built-in persona, plug in your own review command, or add project-specific guidelines via natural language in config. See [`[review]`](#review--review-loop-settings) configuration.

### State Model

Three primitives. That's it. No database server, no Redis, no message queue.

| Primitive | Location | What it is |
|-----------|----------|------------|
| **Beads** | `{project}/.beads/` | Dolt DB — the single source of truth for work items, status, and dependencies |
| **`.worker-status`** | Per worktree | One line of text: `working`, `review`, `blocked: <reason>`, or `dead` |
| **`.worker-feedback`** | Per worktree | Review verdict from the reviewer agent — `VERDICT: approved` or detailed feedback |

## CLI Reference

### Navigation (Positional Arguments)

```bash
orc                            # Root orchestrator (create or attach)
orc <project>                  # Project orchestrator (create or attach)
orc <project> <bead>           # Jump to an engineer's worktree
```

### Admin Commands

| Command | Description |
|---------|-------------|
| `orc init` | First-time setup: symlink CLI, create config, install slash commands |
| `orc add <key> <path>` | Register a project and bootstrap Beads |
| `orc remove <key>` | Unregister a project |
| `orc list` | Show registered projects |
| `orc status` | Dashboard: all projects, goals, and workers at a glance |
| `orc halt <project> <bead>` | Stop an engineer mid-work |
| `orc teardown [project] [goal] [bead]` | Hierarchical cleanup — tear down a bead, a goal, a project, or everything |
| `orc config [project]` | Open config in `$EDITOR` |
| `orc board <project>` | Open the board view |
| `orc leave` | Detach from tmux (agents keep running in the background) |

Exit codes: `0` success, `1` usage error, `2` state error, `3` project not found.

## Slash Commands

Slash commands are how agents coordinate within orc. Each role has access to specific commands:

| Command | Role | What it does |
|---------|------|----------|
| `/orc` | Any | Orientation: your role, available commands, current state |
| `/orc:status` | Any | Run `orc status`, highlight actionable items |
| `/orc:plan` | Project/Goal Orch | Decompose request into goals (project) or beads (goal) |
| `/orc:dispatch` | Project/Goal Orch | Spawn goal orchestrators or engineers for ready work |
| `/orc:check` | Project/Goal Orch | Poll statuses, handle review/blocked/found/dead signals |
| `/orc:complete-goal` | Goal Orch | Trigger delivery (review or PR) when all beads are done |
| `/orc:view` | Orchestrator | Create/adjust tmux monitoring layouts |
| `/orc:done` | Engineer | Self-review, commit, signal for review, then STOP |
| `/orc:blocked` | Engineer | Signal blocked with reason, then STOP |
| `/orc:feedback` | Engineer | Read review feedback, address issues, re-signal, then STOP |
| `/orc:leave` | Any | Report running state, detach from tmux |

## Configuration

Config uses TOML with a three-tier resolution (most specific wins):

```
{project}/.orc/config.toml  →  config.local.toml  →  config.toml
   (project overrides)          (user overrides)      (committed defaults)
```

Edit your overrides: `orc config` (personal) or `orc config <project>` (project-specific).

<details open>
<summary><h3><code>[defaults]</code> — Agent and Worker Settings</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `agent_cmd` | `"claude"` | Agent CLI to launch. Supports `claude`, `opencode`, `codex`, or any CLI that accepts a system prompt. |
| `agent_flags` | `""` | Extra flags passed to every agent invocation. Example: `"--model sonnet"` |
| `agent_template` | `""` | Custom launch template. Use `{cmd}` and `{prompt_file}` placeholders for full control over how agents start. |
| `yolo_flags` | `""` | Auto-accept flags appended in YOLO mode. Empty uses built-in defaults (Claude Code: `--dangerously-skip-permissions`). |
| `max_workers` | `3` | Maximum concurrent engineers per project. New spawns block when the limit is reached. |

</details>

<details open>
<summary><h3><code>[approval]</code> — Human-in-the-Loop Gates</h3></summary>

Three checkpoints where orc can pause for your go-ahead:

| Key | Default | Description |
|-----|---------|-------------|
| `spawn` | `"ask"` | Gate before spawning an engineer. `"ask"` = prompt you. `"auto"` = spawn immediately. |
| `review` | `"auto"` | Gate before launching the reviewer. `"ask"` = prompt. `"auto"` = review automatically. |
| `merge` | `"ask"` | Gate before merging an approved bead to the goal branch. `"ask"` = prompt. `"auto"` = merge immediately. |

</details>

<details open>
<summary><h3><code>[review]</code> — Review Loop Settings</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `max_rounds` | `3` | Max review-feedback cycles per bead before escalating to you. |
| `command` | `""` | Reviewer strategy. `""` = built-in reviewer persona. `"/ocr:review"` = multi-agent OCR review. Or any custom command. |
| `instructions` | `""` | Extra instructions appended to the reviewer's prompt. Use for project-specific review guidelines. |

</details>

<details>
<summary><h3><code>[branching]</code> — Branch Naming</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `strategy` | `""` | Natural language branch naming preference. Empty uses defaults: `feat/`, `fix/`, `task/` prefixes. |

Examples:
```toml
strategy = "use Jira ticket prefix like PROJ-123, then kebab-case summary"
strategy = "always prefix with team name: platform/"
strategy = "gitflow: feature branches from develop"
```

</details>

<details>
<summary><h3><code>[delivery]</code> — Goal Completion</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `mode` | `"review"` | What happens when a goal is done. `"review"` = present the branch for inspection. `"pr"` = push and create a PR via `gh`. |
| `target_strategy` | `""` | Natural language PR target branch logic. Only used in PR mode. Empty defaults to `main`. |

Examples:
```toml
target_strategy = "target develop for features, main for hotfixes"
target_strategy = "gitflow: develop for features, release branch for fixes"
```

</details>

<details>
<summary><h3><code>[board]</code> — Board Visualization</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `command` | `""` | Custom board command for `orc board`. Empty uses the built-in fallback (`watch bd list`). |

</details>

<details>
<summary><h3><code>[layout]</code> — tmux Pane Management</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `min_pane_width` | `40` | Minimum pane width (columns). Below this, orc creates an overflow window instead. |
| `min_pane_height` | `10` | Minimum pane height (rows). Same overflow behavior. |

</details>

<details>
<summary><h3><code>[theme]</code> — tmux Visual Theme</h3></summary>

Set `enabled = false` to keep your existing tmux theme and only apply functional options.

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Apply orc's tmux theme. `false` = keep your own. |
| `accent` | `"#00ff88"` | Primary accent — status bar highlights, active borders. |
| `bg` | `"#0d1117"` | Status bar background. |
| `fg` | `"#8b949e"` | Status bar text. |
| `border` | `"#30363d"` | Inactive pane/window borders. |
| `muted` | `"#6e7681"` | De-emphasized text (version, separators). |
| `activity` | `"#d29922"` | Window activity highlight (amber). |

</details>

## YOLO Mode

Sometimes you don't want to babysit. You want to say "go" and come back to finished work. That's YOLO mode.

```bash
orc myapp --yolo
```

Or via environment variable:

```bash
export ORC_YOLO=1
orc myapp
```

**What changes in YOLO mode:**
- All approval gates (`spawn`, `review`, `merge`) are skipped — no "Shall I proceed?" prompts
- Planning auto-continues to dispatching — goals and beads are created and engineers are spawned in one shot
- Agents launch with auto-accept flags (Claude Code: `--dangerously-skip-permissions`)

**What doesn't change (the safety net):**

Orc **always** escalates to you, even in YOLO mode, when:

- An engineer is blocked and can't self-resolve
- A bead exhausts `max_rounds` of review without approval
- A merge conflict needs manual resolution
- An engineer discovers out-of-scope work that needs your call

> Autonomous doesn't mean reckless.

## Review Loop

Every bead goes through a review before merge. No exceptions. Two-pane model per worktree:

```
┌──────────────────────────────┬───────────────────┐
│                              │                   │
│     Engineering Pane         │    Review Pane     │
│     (persistent — the        │    (ephemeral —    │
│      engineer lives here)    │     spawns for     │
│                              │     each review)   │
│                              │     ~40% width     │
│                              │                   │
└──────────────────────────────┴───────────────────┘
```

**The cycle:**

1. Engineer finishes work, runs `/orc:done` → signals `review`
2. Goal orchestrator spawns reviewer in the review pane
3. Reviewer evaluates against acceptance criteria → writes verdict to `.worker-feedback`
4. **Approved** → fast-forward merge bead to goal branch, tear down worktree
5. **Not approved** → feedback delivered to engineer → engineer runs `/orc:feedback` → fixes → re-signals
6. Repeats up to `max_rounds` (default 3), then escalates to you

## Customizing Personas

Orc ships with five default personas in [`packages/personas/`](packages/personas/):

| Persona | File | Role |
|---------|------|------|
| Root Orchestrator | `root-orchestrator.md` | Cross-project coordination |
| Project Orchestrator | `orchestrator.md` | Goal decomposition and dispatch |
| Goal Orchestrator | `goal-orchestrator.md` | Bead management and delivery |
| Engineer | `engineer.md` | Isolated implementation |
| Reviewer | `reviewer.md` | Code review verdicts |

**Override per project** — create `{project}/.orc/{role}.md`:

```bash
mkdir -p /path/to/myapp/.orc
cp packages/personas/engineer.md /path/to/myapp/.orc/engineer.md
# Add your project's conventions, test commands, architecture notes
```

Project personas are **additive** — they layer on top of `CLAUDE.md`, `.claude/` rules, and existing AI config. See [`packages/personas/README.md`](packages/personas/README.md) for format details.

## tmux Layout

All agents live in one tmux session (`orc`). Hierarchy mirrors the command structure:

```
Session: orc
├── orc                              ← Root orchestrator
├── status                           ← Live dashboard
├── myapp                            ← Project orchestrator
├── myapp/fix-auth                   ← Goal orchestrator
├── myapp/fix-auth/bd-a1b2           ← Engineer (eng + review panes)
├── myapp/fix-auth/bd-c3d4           ← Engineer
├── myapp/add-rate-limit             ← Goal orchestrator
├── myapp/add-rate-limit/bd-e5f6     ← Engineer
├── myapp/board                      ← Board view
└── api                              ← Another project
```

**Status indicators** on windows: `●` working, `✓` in review, `✗` blocked.

**Navigation:**

| Action | Command |
|--------|---------|
| Detach (agents keep running) | `orc leave` |
| Reattach to a project | `orc myapp` |
| Jump to an engineer | `orc myapp bd-a1b2` |
| View the dashboard | Switch to the `status` window in tmux |

## Project Structure

```
orc/
├── assets/
│   └── orc-ascii.svg                # Logo
├── config.toml                      # Committed defaults
├── config.local.toml                # Your overrides (gitignored)
├── projects.toml                    # Project registry (gitignored)
├── packages/
│   ├── cli/                         # The `orc` CLI — pure bash, no build step
│   │   ├── bin/orc                  # Entry point with positional routing
│   │   └── lib/                     # Subcommand scripts + shared helpers
│   ├── commands/                    # Slash commands (markdown, installed via symlinks)
│   │   ├── claude/orc/              # Claude Code commands
│   │   └── windsurf/                # Windsurf commands
│   └── personas/                    # Agent personas (markdown)
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── goal-orchestrator.md
│       ├── engineer.md
│       └── reviewer.md
└── openspec/                        # Change proposals and specifications
```

**In registered projects:**

| Directory | Purpose | Tracked? |
|-----------|---------|----------|
| `.beads/` | Beads database (work items, status, deps) | gitignored |
| `.worktrees/` | Engineer worktrees (isolated checkouts) | gitignored |
| `.orc/` | Config and persona overrides for this project | committed |

## Troubleshooting

<details>
<summary><strong><code>bd: command not found</code></strong></summary>

Install [Beads](https://github.com/thefinalsource/beads). It's the work tracking layer orc depends on.

</details>

<details>
<summary><strong>tmux session died or agents are unresponsive</strong></summary>

Just run `orc` or `orc <project>` again — it recreates the session and reattaches. To clean up stale state: `orc teardown`.

</details>

<details>
<summary><strong>Engineer is stuck or blocked</strong></summary>

The `.worker-status` file in the worktree will say `blocked: <reason>`. Options:
- Provide context to unblock the engineer
- Tear down and respawn: `orc teardown <project> <bead>`, then re-dispatch

</details>

<details>
<summary><strong>Merge conflict on bead merge</strong></summary>

Orc escalates merge conflicts to you — it never force-pushes or auto-resolves. Resolve manually on the goal branch, then continue.

</details>

<details>
<summary><strong>Too many workers / spawn blocked</strong></summary>

Increase the limit: `orc config` → set `max_workers = 5` under `[defaults]`.

</details>

<details>
<summary><strong>Agents using the wrong CLI</strong></summary>

Set `agent_cmd` in your config. Globally: `orc config` → `[defaults] agent_cmd = "opencode"`. Per-project: create `{project}/.orc/config.toml`.

</details>

---

<p align="center">
  <strong>Shell over runtime. Markdown is the control plane. Beads are the only state.</strong>
  <br />
  <em>Now go. Release the horde.</em>
</p>

---

## License

See [LICENSE](LICENSE) for details.
