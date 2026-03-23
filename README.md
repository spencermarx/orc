<p align="center">
  <img src="assets/orc-cover.png" alt="orc" width="800" />
</p>

<p align="center">
  <strong>A lightweight SDLC framework for AI coding agents.</strong>
  <br />
  <em>Plan, build, review, and deliver — with your tools, your workflow, your rules.</em>
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
- [Supported Agent CLIs](#supported-agent-CLIs)
- [CLI Reference](#cli-reference)
- [Slash Commands](#slash-commands)
- [Configuration](#configuration)
- [YOLO Mode](#yolo-mode)
- [Review Loop](#review-loop)
- [Planning Lifecycle](#planning-lifecycle)
- [Notifications](#notifications)
- [Project Setup](#project-setup)
- [Config Doctor](#config-doctor)
- [Customizing Personas](#customizing-personas)
- [tmux Layout](#tmux-layout)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

</details>

---

## Why Orc?

AI coding agents are powerful — but they need structure. Without it, you get scattered PRs, conflicting changes, skipped reviews, and no visibility into what's happening. Orc gives your agents a complete software development lifecycle.

- **Plan with your tools** — plug in [OpenSpec](https://github.com/thefinalsource/openspec), Kiro, or any planning approach. Orc delegates plan creation to a dedicated planner agent, then decomposes the plan into focused work items using your project-specific conventions.
- **Build in parallel** — every engineer gets its own git worktree. Zero conflicts, zero coordination headaches. Five agents working simultaneously on different parts of the same feature.
- **Review before merge** — two-tier review: fast bead-level loops during development, deep goal-level review before delivery. Plug in your own review tools or use the built-in reviewer.
- **Deliver your way** — push + PR, ticket updates, spec archival, Slack notifications — describe your delivery pipeline in natural language and orc executes it.
- **Stay informed** — condition-based notifications auto-resolve when agents handle things. You only see what needs your attention right now.

Every lifecycle phase is configurable with natural language — no rigid schemas, no enum switches. Run `orc setup myapp` and orc discovers your tools, asks about your workflow, and writes the config.

Orc runs on tmux, git, and plain markdown. It works with any agentic CLI — [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenCode](https://opencode.ai), [Codex](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or your own. No daemon, no server, no framework.

<p align="center">
  <img src="assets/orc-in-action.png" alt="Orc in action — goal orchestrator managing beads while an engineer implements in an isolated worktree" width="900" />
  <br />
  <sub>A goal orchestrator (left) dispatches and monitors engineers working in isolated worktrees (right).</sub>
</p>

## The 30-Second Version

```
  "Fix auth, add rate limiting, update docs"
                    │
                    ▼
            ┌──── orc ────┐                     You describe the work.
            │      │      │
            ▼      ▼      ▼
      fix/auth  feat/rate  task/docs             Orc creates goal branches.
            │      │      │
            ▼      ▼      ▼
          Plan → Decompose → Dispatch            (Optional) Plan with your tools,
                                                 then decompose into beads.
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
          Deliver (PR, tickets, etc.)            Your delivery pipeline runs.
```

## Quick Start

### 1. Install Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [Beads](https://github.com/thefinalsource/beads) (`bd`) | Work tracking (Dolt-backed) | See Beads repo |
| [tmux](https://github.com/tmux/tmux) 3.0+ | Session management | `brew install tmux` / `apt install tmux` |
| `git` | Worktrees and branching | Pre-installed on most systems |
| `bash` 4+ | CLI runtime | `brew install bash` (macOS ships 3.x) |
| Agent CLI | Your AI coding agents | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenCode](https://opencode.ai), [Codex](https://github.com/openai/codex), or [Gemini CLI](https://github.com/google-gemini/gemini-cli) |

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

> **What this touches in your project:** `orc add` initializes a `.beads/` directory for work tracking (via `bd init`) and adds orc runtime paths (`.beads/`, `.worktrees/`, `.goals/`) to your repo's `.git/info/exclude` so they're invisible to git. No files in your project are modified — orc uses git's built-in per-repo exclude, not your `.gitignore`.

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
[review.dev]
# Bead-level review: use a custom tool or add project-specific guidelines
review_instructions = "Focus on security: check for SQL injection, XSS, and auth bypass. All new endpoints must have rate limiting."
max_rounds = 5

[review.goal]
# Goal-level review: deep review before delivery (opt-in)
review_instructions = "/ocr:review — post the review to the GitHub PR"
how_to_determine_if_review_passed = "The review output contains no outstanding issues requiring changes"
how_to_address_review_feedback = "Run the review tool's address command with the path to the review output file"
max_rounds = 3
```

`review_instructions` accepts a slash command, natural language guidelines, or both. See [`[review.dev]`](#reviewdev--dev-review-bead-level) and [`[review.goal]`](#reviewgoal--goal-review-goal-level) for full reference.

### Configuring Branching and Delivery

Control how orc names branches and what happens when a goal is complete:

```toml
# In config.local.toml (global) or {project}/.orc/config.toml (per-project)

[branching]
strategy = "use Jira ticket prefix like PROJ-123, then kebab-case summary"

[delivery.goal]
# Natural language — describe your full delivery pipeline
on_completion_instructions = """
  Push the goal branch and create a PR targeting develop.
  Move the Jira ticket to In Code Review.
"""
when_to_involve_user_in_delivery = "always"
```

With `on_completion_instructions` set, the goal orchestrator executes your delivery pipeline automatically. Common patterns: push + PR, push + PR + ticket update, push + PR + archive specs.

With `on_completion_instructions` empty (default), the goal branch is presented for your inspection in the tmux session. You review and provide feedback or merge manually.

**Combining with YOLO mode** for a fully hands-off pipeline:

```bash
orc myapp --yolo
# Goals are planned, engineers are dispatched, reviews run automatically,
# and PRs are created — all without confirmation prompts.
# You come back to open PRs ready for your review.
```

**Keeping tickets in sync** — if your project uses Jira, Linear, or GitHub Issues and has a skill or MCP for it, orc can automatically update tickets as work progresses:

```toml
# In {project}/.orc/config.toml
[tickets]
strategy = "Move Jira tickets to In Progress when goals start, Done when complete"
```

Just pass ticket links to the orchestrator — it handles the rest. See [`[tickets]`](#tickets--ticket-integration) configuration.

## How It Works

Orc implements a full software development lifecycle — **plan, build, review, deliver** — adapted to your project's tools and workflow. Every phase is a configurable hook: you tell orc *what tool to use* and *when to involve you*, and orc handles the orchestration.

You describe what you want. Orc breaks it into **goals** (deliverables with dedicated branches). If planning is configured, a planner sub-agent creates formal plan artifacts (design docs, specs, task lists) using your tool of choice. The goal orchestrator then decomposes into **beads** (focused work items), dispatches engineers into isolated worktrees, manages the review loop, and delivers via your configured pipeline.

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

### The Lifecycle

Every goal follows the same configurable lifecycle. Each phase is a hook you control:

```
Investigate → Plan → Decompose → Dispatch → Build → Review → Deliver
                │         │          │                 │         │
          [planning.goal] │   [dispatch.goal]    [review.*]  [delivery.goal]
                          │
                   [planning.goal]
                bead_creation_instructions
```

| Phase | What happens | You configure |
|-------|-------------|---------------|
| **Investigate** | Scouts explore the codebase | (automatic) |
| **Plan** | Planner sub-agent creates design docs, specs, task lists | `plan_creation_instructions` — your planning tool |
| **Decompose** | Goal orchestrator maps plan to beads | `bead_creation_instructions` — your decomposition conventions |
| **Dispatch** | Engineers spawn in isolated worktrees | `assignment_instructions` — what every engineer is told |
| **Build** | Engineers implement in parallel | (automatic) |
| **Review** | Two-tier review loop | `review_instructions` — your review tool |
| **Deliver** | Push, PR, ticket updates, etc. | `on_completion_instructions` — your delivery pipeline |

Every field is natural language interpreted by the agent. Empty = sensible default. The lifecycle adapts to your project — skip planning for simple fixes, add deep review for critical features, automate delivery for trusted pipelines.

### Agent Hierarchy

Four tiers — every level has a clear job and hard boundaries:

```
Root Orchestrator ─── cross-project coordination
  └─→ Project Orchestrator ─── creates goals, monitors progress
        └─→ Goal Orchestrator ─── owns one goal, manages the full lifecycle
              ├─→ Planner (ephemeral) ─── creates plan artifacts
              ├─→ Scouts (ephemeral) ─── investigate codebase
              └─→ Worktree ─── isolated git worktree per bead
                    ├── Engineer (persistent) ─── implements the bead
                    └── Reviewer (ephemeral) ─── reviews the work
```

| Tier | Responsibility | Never does |
|------|---------------|------------|
| **Root Orchestrator** | Coordinates across projects, routes your requests | Write code, manage beads |
| **Project Orchestrator** | Decomposes requests into goals, dispatches goal orchestrators, monitors progress | Write code, manage engineers directly |
| **Goal Orchestrator** | Owns one goal: delegates planning, decomposes into beads, dispatches engineers, manages the review loop, merges to goal branch, executes delivery | Write code, touch other goals |
| ↳ **Planner** | Creates plan artifacts (design docs, specs, task lists) using your configured tool | Decompose into beads, dispatch engineers |
| ↳ **Scouts** | Investigate codebase areas, return findings | Make decisions, write code |
| ↳ **Engineer** | Implements a bead in an isolated worktree | Push, merge, create PRs |
| ↳ **Reviewer** | Evaluates work against acceptance criteria, writes verdict | Modify code, change bead state |

Plus: **Configurator** (assembles project config during `orc setup`).

Reviewers and planners are fully customizable — plug in your own tools via natural language in config, or override the default persona per project.

### State Model

Three primitives. That's it. No database server, no Redis, no message queue.

| Primitive | Location | What it is |
|-----------|----------|------------|
| **Beads** | `{project}/.beads/` | Dolt DB — the single source of truth for work items, status, and dependencies |
| **`.worker-status`** | Per worktree | One line of text: `working`, `review`, `blocked: <reason>`, `question: <question>`, or `dead` |
| **`.worker-feedback`** | Per worktree | Review verdict from the reviewer agent — `VERDICT: approved` or detailed feedback |

## Supported Agent CLIs

Orc doesn't care which AI does the coding — it just needs something that can accept a prompt and run in a terminal. Swap your engine with one line of config.

```toml
# config.local.toml (or {project}/.orc/config.toml)
[defaults]
agent_cmd = "claude"    # ← change this
```

### First-Class Adapters

Each adapter handles the CLI's specific quirks — prompt delivery, auto-approval, slash command installation — so orc's orchestration works identically regardless of which engine is underneath.

| CLI | `agent_cmd` | Prompt Delivery | Auto-Approval | Custom Commands |
|-----|-------------|-----------------|---------------|-----------------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude` | `--append-system-prompt` flag | `--dangerously-skip-permissions` | `~/.claude/commands/orc/` (MD) |
| [OpenCode](https://opencode.ai) | `opencode` | `.opencode/agents/` config files | Per-agent permission block | `.opencode/commands/` (MD) |
| [Codex](https://github.com/openai/codex) | `codex` | `AGENTS.md` in worktree | `--dangerously-bypass-approvals-and-sandbox` | N/A (built-in only) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `gemini` | `GEMINI.md` in worktree | `--yolo` | `.gemini/commands/orc/` (TOML) |

### Bring Your Own CLI

Any agent CLI that runs in a terminal works. If there's no dedicated adapter, orc falls back to the generic adapter which uses `agent_template` for full control:

```toml
[defaults]
agent_cmd = "my-agent"
agent_template = "my-agent --system-prompt {prompt_file} --input {prompt}"
yolo_flags = "--auto-approve"
```

Template placeholders: `{cmd}` (agent_cmd value), `{prompt_file}` (path to persona file), `{prompt}` (inline persona content).

### Writing a New Adapter

Adapters live at `packages/cli/lib/adapters/{name}.sh` — one bash file per CLI. Orc discovers them automatically by matching `agent_cmd` to the filename.

Each adapter implements a simple function contract:

| Function | Purpose |
|----------|---------|
| `_adapter_build_launch_cmd` | Build the shell command to start the agent |
| `_adapter_inject_persona` | Deliver the system prompt (flag, file, or env) |
| `_adapter_yolo_flags` | Return auto-approval flags (or configure file-based approval) |
| `_adapter_install_commands` | Install slash commands in the CLI's format |
| `_adapter_pre_launch` | Pre-launch worktree setup (optional) |
| `_adapter_post_teardown` | Cleanup after worktree removal (optional) |

See [`packages/cli/lib/adapters/generic.sh`](packages/cli/lib/adapters/generic.sh) for the full contract and contributor guide.

---

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
| `orc teardown [project] [bead-or-goal]` | Hierarchical cleanup — tear down a bead, a goal, a project, or everything |
| `orc config [project]` | Open config in `$EDITOR` |
| `orc board <project>` | Open the board view |
| `orc leave` | Detach from tmux (agents keep running in the background) |
| `orc doctor [--auto-fix\|--fix]` | Validate config and assist with migration |
| `orc notify [--all\|--clear\|--goto N]` | View and navigate notifications |
| `orc setup <project>` | Guided project config setup |

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
| `agent_cmd` | `"claude"` | Agent CLI to launch. Built-in adapters: `claude`, `opencode`, `codex`, `gemini`. Any other value uses the generic adapter. See [Supported Agent CLIs](#supported-agent-clis). |
| `agent_flags` | `""` | Extra flags passed to every agent invocation. Example: `"--model sonnet"` |
| `agent_template` | `""` | Custom launch template (overrides adapter). Placeholders: `{cmd}`, `{prompt_file}`, `{prompt}`. See [Bring Your Own CLI](#bring-your-own-cli). |
| `yolo_flags` | `""` | Auto-accept flags appended in YOLO mode. Empty uses adapter defaults (`claude`: `--dangerously-skip-permissions`, `codex`: `--dangerously-bypass-approvals-and-sandbox`, `gemini`: `--yolo`). |
| `max_workers` | `3` | Maximum concurrent engineers per project. New spawns block when the limit is reached. |

</details>

<details open>
<summary><h3><code>[planning.goal]</code> — Planning Lifecycle</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `plan_creation_instructions` | `""` | How to create the plan — passed to a planner sub-agent. A slash command, natural language, or both. `""` = skip planning, decompose directly. |
| `bead_creation_instructions` | `""` | How to create beads from plan artifacts. Project-specific conventions for decomposition. `""` = goal orchestrator uses default judgment. |
| `when_to_involve_user_in_plan` | `""` | When to pause for your review before decomposing into beads. `""` = always. |

</details>

<details>
<summary><h3><code>[dispatch.goal]</code> — Engineer Assignment</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `assignment_instructions` | `""` | What to include in every engineer's assignment. Applied universally — planned and unplanned goals. `""` = goal orchestrator uses default judgment. |

</details>

<details open>
<summary><h3><code>[approval]</code> — Human-in-the-Loop Gates</h3></summary>

Three checkpoints where orc can pause for your go-ahead:

| Key | Default | Description |
|-----|---------|-------------|
| `ask_before_dispatching` | `"ask"` | Gate before spawning an engineer. `"ask"` = prompt you. `"auto"` = spawn immediately. |
| `ask_before_reviewing` | `"auto"` | Gate before launching the reviewer. `"ask"` = prompt. `"auto"` = review automatically. |
| `ask_before_merging` | `"ask"` | Gate before merging an approved bead to the goal branch. `"ask"` = prompt. `"auto"` = merge immediately. |

</details>

<details open>
<summary><h3><code>[review.dev]</code> — Dev Review (Bead-Level)</h3></summary>

Fast, tight review loops during development. Each bead is reviewed before merging to the goal branch.

| Key | Default | Description |
|-----|---------|-------------|
| `review_instructions` | `""` | How to perform the review — a slash command, natural language guidelines, or both. `""` = built-in reviewer persona. |
| `how_to_determine_if_review_passed` | `""` | How to determine the review passed. `""` = parse `VERDICT: approved` from `.worker-feedback`. |
| `max_rounds` | `3` | Max review-feedback cycles per bead before escalating to you. |

</details>

<details>
<summary><h3><code>[review.goal]</code> — Goal Review (Goal-Level)</h3></summary>

Deep, comprehensive review after all beads pass dev review. This is the quality gate before delivery. **Opt-in: when `command` is empty (default), this tier is skipped.**

Works with any review tool — e.g., [Open Code Review](https://github.com/spencermarx/open-code-review) (`/ocr:review`) for deep multi-agent review posted to PRs.

| Key | Default | Description |
|-----|---------|-------------|
| `review_instructions` | `""` | How to perform the goal-level review. `""` = skip, go straight to delivery. A slash command, natural language, or both. |
| `how_to_determine_if_review_passed` | `""` | How to determine the review passed. Example: `"The review output contains no outstanding issues requiring changes"`. |
| `how_to_address_review_feedback` | `""` | How engineers should address rejection feedback. Example: `"Run the review tool's address command with the path to the review output file"`. |
| `max_rounds` | `3` | Max goal-level review cycles before escalating. If not approved, engineers address feedback and the goal-level review re-runs. |

`review_instructions` is **how to review**. `how_to_determine_if_review_passed` is **how to know it passed**. `how_to_address_review_feedback` is **how to fix it if it didn't**.

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
<summary><h3><code>[delivery.goal]</code> — Goal Completion</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `on_completion_instructions` | `""` | What to do when a goal completes. Natural language describing your delivery pipeline. `""` = present the branch for manual review. |
| `when_to_involve_user_in_delivery` | `""` | When to pause for your approval before executing delivery. `""` = always. |

Examples:
```toml
on_completion_instructions = "push the goal branch and create a PR targeting main"
on_completion_instructions = """
  Push the goal branch, create a PR targeting develop,
  move the Jira ticket to In Code Review,
  archive the openspec change.
"""
when_to_involve_user_in_delivery = "when the PR targets main or involves breaking changes"
```

</details>

<details>
<summary><h3><code>[tickets]</code> — Ticket Integration</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `strategy` | `""` | Natural language ticket integration strategy. Empty = don't touch tickets. Requires the project to have a skill or MCP for the ticketing system. |

This is a **project-level concern** — set it in `{project}/.orc/config.toml`, not globally. When configured, orchestrators automatically update linked tickets at lifecycle moments (goal started, progress made, goal delivered, blockers hit).

Examples:
```toml
strategy = "Move Jira tickets to In Progress when goals start, Done when complete"
strategy = "Add a comment to Linear issues with the goal branch name and progress updates"
strategy = "Update GitHub issues: In Progress on start, close with PR link on delivery"
```

</details>

<details>
<summary><h3><code>[notifications]</code> — Push Notifications</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `system` | `false` | Send OS-level notifications (`terminal-notifier` on macOS, `notify-send` on Linux). |
| `sound` | `false` | Audible alert with notifications. |

The tmux status bar always shows active notification count regardless of this setting.

</details>

<details>
<summary><h3><code>[updates]</code> — Version Awareness</h3></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `check_on_launch` | `true` | Check for orc updates on launch. Non-blocking, 2-second timeout. |

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
| `mouse` | `true` | Enable mouse support (pane selection, resizing, scrollback). Only when themed. |

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
- Agents launch with auto-accept flags (each adapter knows its CLI's flag: Claude → `--dangerously-skip-permissions`, Codex → `--dangerously-bypass-approvals-and-sandbox`, Gemini → `--yolo`, OpenCode → file-based permissions)

**What doesn't change (the safety net):**

Orc **always** escalates to you, even in YOLO mode, when:

- An engineer is blocked and can't self-resolve
- A bead exhausts `max_rounds` of review without approval
- A merge conflict needs manual resolution
- An engineer discovers out-of-scope work that needs your call
- A notification needs your attention (QUESTION, ESCALATION)

> Autonomous doesn't mean reckless.

## Review Loop

Orc uses a **two-tier review model** — fast loops during development, deep review before delivery.

### Dev Review (Short Cycle)

Every bead goes through dev review before merging to the goal branch. The reviewer spawns directly below the engineer:

```
┌──────────────────────────────┐
│     Engineer Pane            │
│     (persistent)             │
├──────────────────────────────┤
│     Reviewer Pane            │
│     (ephemeral — spawns per  │
│      review cycle)           │
└──────────────────────────────┘
```

1. Engineer finishes work, runs `/orc:done` → signals `review`
2. Goal orchestrator spawns reviewer with `[review.dev]` config
3. Reviewer evaluates → writes verdict to `.worker-feedback`
4. **Approved** → fast-forward merge bead to goal branch, tear down worktree
5. **Not approved** → feedback to engineer → fix → re-signal
6. Repeats up to `[review.dev] max_rounds` (default 3), then escalates

### Goal Review (Long Cycle)

After all beads pass dev review, if `[review.goal] review_instructions` is configured, the goal orchestrator enters a deeper review cycle before delivery:

1. Goal orchestrator runs the configured command (e.g., `/ocr:review`) against the full goal branch
2. Review evaluates the entire deliverable — not just individual beads
3. **Approved** → proceed to delivery
4. **Not approved** → goal orchestrator creates new beads to address feedback, engineers fix, dev review runs, then goal review re-runs
5. Repeats up to `[review.goal] max_rounds`, then escalates

This tier is **opt-in**. When `[review.goal] review_instructions` is empty (default), the goal orchestrator skips straight to delivery after all beads pass dev review.

## Planning Lifecycle

Orc treats planning as a first-class lifecycle phase — not an afterthought. Plug in any planning tool and orc handles the orchestration: delegate to a planner, get your review, decompose into work items, and brief engineers with full context.

**Planning is opt-in.** When unconfigured, the goal orchestrator decomposes work directly from scout findings. When configured, you get a formal planning phase that produces design docs, specs, and task lists before any code is written.

### Bring Your Own Planning Tool

Orc is tool-agnostic. Tell it what to run:

```toml
# In {project}/.orc/config.toml

[planning.goal]
# Any planning tool — a slash command, natural language, or both
plan_creation_instructions = "/openspec:proposal"
```

The goal orchestrator delegates plan creation to an ephemeral **planner sub-agent** that runs your tool with full codebase context from scout findings. Examples:

| Tool | Config value |
|------|-------------|
| [OpenSpec](https://github.com/thefinalsource/openspec) | `"/openspec:proposal"` |
| Custom design doc | `"Create a technical design doc in .orc-state/goals/{goal}/plan.md"` |
| Kiro specs | `"/kiro:spec — focus on API contracts"` |
| Plain task list | `"Create a numbered task list with acceptance criteria for each item"` |

### From Plan to Work Items

After the plan is created, orc needs to know how to turn those artifacts into beads. This varies by planning tool — OpenSpec produces `tasks.md`, a design doc might have numbered sections, a spec might have user stories.

```toml
[planning.goal]
# How to decompose plan artifacts into beads — your project's conventions
bead_creation_instructions = "Decompose beads from tasks.md in the openspec change directory. Each bead maps to one or more task items."
```

When empty, the goal orchestrator reads the plan artifacts and uses its own judgment. When set, it follows your conventions for how the plan maps to work.

### When You Review

Control when orc pauses for your input:

```toml
[planning.goal]
when_to_involve_user_in_plan = "when the plan involves more than 3 beads or touches core domain models"
```

Common values: `"always"` (default), `"never"` (full autonomy), or natural-language conditions.

### Engineer Briefing

Control what every engineer receives in their assignment — regardless of whether a plan was used:

```toml
[dispatch.goal]
assignment_instructions = """
  Include the full proposal directory path so engineers can reference design docs.
  Quote specific tasks from the plan verbatim.
  Instruct engineers to read the proposal for full context before starting.
"""
```

This is a universal touchpoint — it applies to every dispatch, whether from an OpenSpec proposal, a design doc, or direct decomposition. Useful for project-wide conventions: "always include the test command," "always reference CLAUDE.md sections," "always state the acceptance criteria format."

### Feedback Loops

**Questions**: Engineers can ask clarifying questions about the plan or assignment via the `question:` status signal. The goal orchestrator answers directly when it can, or involves you when domain knowledge is needed.

**Plan invalidation**: If an engineer discovers a plan assumption is wrong, they signal `found: plan-issue` — the goal orchestrator pauses affected work, re-engages the planner, and re-decomposes. The plan adapts to reality.

## Notifications

Orc uses a **condition-based** notification system — the status bar shows actionable conditions, not event history. When a condition clears, the notification auto-resolves. You never manually dismiss.

### What You See

The tmux status bar shows an active count: `● 2 active`. Window tabs highlight when they contain panes needing attention. Pane borders change color for blocked or questioning engineers.

### Notification Types

| Condition | When it fires | Auto-resolves when |
|-----------|---------------|-------------------|
| `PLAN_REVIEW` | Plan ready for your review | You review and the goal orchestrator proceeds |
| `QUESTION` | Engineer question the goal orch can't answer | You provide the answer |
| `BLOCKED` | Engineer stuck | Block is cleared |
| `DELIVERY` | Goal ready for delivery approval | You approve delivery |
| `ESCALATION` | Max review rounds hit | You intervene |

### Navigating to Notifications

```bash
orc notify              # Interactive — pick a number to jump to the relevant pane
orc notify --goto 1     # Jump directly to notification #1
orc notify --all        # Full history (resolved and active)
orc notify --clear      # Force-resolve all active notifications
```

### OS-Level Alerts (Optional)

```toml
[notifications]
system = true    # Desktop notifications (terminal-notifier on macOS, notify-send on Linux)
sound = true     # Audible alert
```

## Project Setup

`orc setup` provides a guided, conversational experience for configuring a project. It scouts your project for available tools, asks about your workflow, and assembles a tailored config.

```bash
orc setup myapp
```

The project orchestrator investigates your codebase — discovers planning tools (OpenSpec, Kiro), review tools (OCR), delivery infrastructure (gh CLI, CI/CD), ticketing integrations (Jira/Linear MCPs), and test frameworks. Then it walks you through each lifecycle phase, only asking relevant questions.

Run it again any time to reconfigure:

```bash
orc setup myapp         # Reconfigure — existing config used as starting point
orc setup myapp --yolo  # Auto-configure with sensible defaults from scout findings
```

## Config Doctor

After updating orc, run `orc doctor` to check your config:

```bash
orc doctor              # Fast validation — reports issues with migration guidance
orc doctor --auto-fix   # Apply mechanical renames (field name changes) automatically
orc doctor --fix        # Interactive migration — agent walks you through semantic changes
```

`--fix` launches the root orchestrator with your migration context. It reads `migrations/CHANGELOG.md`, understands what changed and why, reads each affected project's config, and suggests concrete migrations conversationally.

## Customizing Personas

Orc ships with five default personas in [`packages/personas/`](packages/personas/):

| Persona | File | Role |
|---------|------|------|
| Root Orchestrator | `root-orchestrator.md` | Cross-project coordination |
| Project Orchestrator | `orchestrator.md` | Goal decomposition and dispatch |
| Goal Orchestrator | `goal-orchestrator.md` | Bead management and delivery |
| Engineer | `engineer.md` | Isolated implementation |
| Reviewer | `reviewer.md` | Code review verdicts |
| Planner | `planner.md` | Plan creation (ephemeral sub-agent) |
| Configurator | `configurator.md` | Config assembly during `orc setup` (ephemeral sub-agent) |

**Override per project** — create `{project}/.orc/{role}.md`:

```bash
mkdir -p /path/to/myapp/.orc
cp packages/personas/engineer.md /path/to/myapp/.orc/engineer.md
# Add your project's conventions, test commands, architecture notes
```

Project personas are **additive** — they layer on top of `CLAUDE.md`, `.claude/` rules, and existing AI config. See [`packages/personas/README.md`](packages/personas/README.md) for format details.

## tmux Layout

All agents live in one tmux session (`orc`). Each goal gets its own window with the goal orchestrator as the main pane and engineers on the right:

```
Session: orc
├── orc                              ← Root orchestrator
├── status                           ← Live dashboard
├── myapp                            ← Project orchestrator
├── myapp/fix-auth                   ← Goal window (layout below)
├── myapp/add-rate-limit             ← Goal window
├── myapp/board                      ← Board view
└── api                              ← Another project
```

**Inside each goal window** — `main-vertical` layout with the goal orchestrator on the left and engineers (+ ephemeral reviewers) on the right:

```
┌──────────────────────────────┬──────────────────┐
│                              │  eng: bd-a1b2    │
│                              │  (being reviewed) │
│   goal: fix-auth             ├──────────────────┤
│   (Goal Orchestrator)        │  ▸ rev: bd-a1b2  │
│                              │  (ephemeral)     │
│   pane 0 — persistent,      ├──────────────────┤
│   manages the review loop    │  eng: bd-c3d4    │
│                              │  (working)       │
└──────────────────────────────┴──────────────────┘
```

Each reviewer spawns directly below its engineer — a clear visual pair. When the review ends, the reviewer pane is destroyed and the engineer reclaims the space.

When a window can't fit more panes (below `min_pane_width`/`min_pane_height`), orc creates overflow windows (`myapp/fix-auth:2`, etc.).

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
│   │       └── adapters/            # Per-CLI adapters (claude.sh, codex.sh, etc.)
│   ├── commands/                    # Slash commands
│   │   ├── _canonical/              # Single-source command definitions (all CLIs)
│   │   └── claude/orc/              # Legacy Claude-specific commands
│   └── personas/                    # Agent personas (markdown)
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── goal-orchestrator.md
│       ├── engineer.md
│       └── reviewer.md
├── migrations/
│   └── CHANGELOG.md                 # Migration guide (all versions)
└── openspec/                        # Change proposals and specifications
```

**In registered projects:**

| Directory | Purpose | Created by | Tracked? |
|-----------|---------|------------|----------|
| `.beads/` | Beads database (work items, status, deps) | `orc add` (only project-level change orc makes) | Add to `.gitignore` |
| `.worktrees/` | Engineer worktrees (isolated checkouts) | `orc spawn` (during work) | Add to `.gitignore` |
| `.orc/` | Config and persona overrides | You (opt-in) | Commit if desired |

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

Set `agent_cmd` in your config. Globally: `orc config` → `[defaults] agent_cmd = "opencode"`. Per-project: create `{project}/.orc/config.toml`. See [Supported Agent CLIs](#supported-agent-clis) for all options.

</details>

<details>
<summary><strong>Custom CLI not launching correctly</strong></summary>

If your agent CLI uses non-standard flags, set `agent_template` to control the exact launch command:

```toml
[defaults]
agent_cmd = "my-agent"
agent_template = "my-agent --system {prompt_file} --input {prompt}"
```

Check `packages/cli/lib/adapters/generic.sh` for the full template placeholder reference.

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
