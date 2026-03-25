# Configuration Reference

Orc uses [TOML](https://toml.io/) for configuration. All settings are natural language where it matters — the agent interprets your instructions, so you write what you mean.

## Resolution Order

Configuration resolves most-specific-first:

| Priority | File | Scope |
|----------|------|-------|
| 1 (highest) | `{project}/.orc/config.toml` | Per-project overrides |
| 2 | `config.local.toml` | Your personal defaults (gitignored) |
| 3 (lowest) | `config.toml` | Committed repository defaults |

Values from higher-priority files override lower ones. Empty strings fall through to the next level.

## How to Edit

```bash
orc config              # Open config.local.toml in $EDITOR (personal defaults)
orc config <project>    # Open {project}/.orc/config.toml in $EDITOR
orc setup <project>     # Guided setup — a configurator agent walks you through it
```

---

## Full Reference

### `[defaults]` — Agent and Worker Settings

Controls which AI CLI orc launches and how many workers can run in parallel.

| Key | Default | Description |
|-----|---------|-------------|
| `agent_cmd` | `"auto"` | CLI to launch. `auto` detects the first installed CLI in order: `claude`, `opencode`, `codex`, `gemini`. Or set explicitly to any of those names, or a custom CLI. See [Supported Agent CLIs](agent-clis.md#auto-detection) for details. |
| `agent_flags` | `""` | Extra flags passed to every agent launch. |
| `agent_template` | `""` | Custom launch template (overrides adapter). Placeholders: `{cmd}` = agent_cmd, `{prompt_file}` = persona file path, `{prompt}` = file contents. |
| `yolo_flags` | `""` | Auto-accept flags per agent. Empty = use adapter defaults (e.g., `--dangerously-skip-permissions` for Claude). |
| `max_workers` | `3` | Maximum concurrent engineer sessions per project. |

**Example — use Codex with 5 workers:**

```toml
[defaults]
agent_cmd = "codex"
max_workers = 5
```

---

### `[planning.goal]` — Planning Lifecycle

Controls how goals are planned before decomposition into beads. See [Core Concepts: The Lifecycle](concepts.md#the-lifecycle).

Each field has a **WHO** (which agent executes it), **WHEN** (at what point in the lifecycle), and **BOUNDARY** (what does not belong here).

| Key | Default | Description |
|-----|---------|-------------|
| `plan_creation_instructions` | `""` | **WHO:** executed by the **planner sub-agent** (not the goal orchestrator). **WHEN:** after codebase investigation, before bead decomposition. Accepts a slash command, natural language, or both. **BOUNDARY:** do not include bead decomposition guidance, engineer briefing instructions, or orchestration actions (like "notify the user") — those belong in other fields. Empty = skip planning (goal orchestrator decomposes directly). |
| `bead_creation_instructions` | `""` | **WHO:** read by the **goal orchestrator** (not a sub-agent). **WHEN:** after plan artifacts are created, during bead decomposition. Describes how to map plan output to beads (project-specific conventions). **BOUNDARY:** do not include planning tool directives — those belong in `plan_creation_instructions`. Empty = goal orchestrator uses default judgment. |
| `when_to_involve_user_in_plan` | `""` | **WHO:** evaluated by the **goal orchestrator**. **WHEN:** after planner completes, before bead decomposition. This is a **gate** (when to pause for user review), not an action. Empty = `"always"`. |

**Example — use OpenSpec for planning:**

```toml
[planning.goal]
plan_creation_instructions = "/openspec:proposal"
bead_creation_instructions = "Decompose beads from tasks.md. Each bead maps to one or more task items."
when_to_involve_user_in_plan = "always"
```

---

### `[dispatch.goal]` — Engineer Assignment

Controls what context engineers receive when dispatched.

| Key | Default | Description |
|-----|---------|-------------|
| `assignment_instructions` | `""` | **WHO:** read by the **goal orchestrator** when writing `.orch-assignment.md`. **WHEN:** every time an engineer is dispatched (planned or unplanned goals). Content is included in every engineer's assignment on top of bead description and acceptance criteria. **BOUNDARY:** do not include planning or review logic — just briefing content. Empty = goal orchestrator uses default judgment. |

**Example:**

```toml
[dispatch.goal]
assignment_instructions = "Include the full proposal directory path. Quote specific tasks verbatim. Always include the project's test command."
```

---

### `[approval]` — Human-in-the-Loop Gates

Three configurable gates where orc can pause for your confirmation.

| Key | Default | Description |
|-----|---------|-------------|
| `ask_before_dispatching` | `"ask"` | `"ask"` = confirm before spawning workers. `"auto"` = proceed automatically. |
| `ask_before_reviewing` | `"auto"` | `"ask"` = confirm before starting reviews. `"auto"` = proceed automatically. |
| `ask_before_merging` | `"ask"` | `"ask"` = confirm before merging approved beads. `"auto"` = proceed automatically. |

Orc always escalates to a human on: blocked engineers, max review rounds reached, merge conflicts, or out-of-scope discoveries — regardless of these settings.

---

### `[review.dev]` — Bead-Level Review

The short review cycle. Runs after each engineer signals completion. See [Core Concepts: The Lifecycle](concepts.md#the-lifecycle).

| Key | Default | Description |
|-----|---------|-------------|
| `review_instructions` | `""` | **WHO:** executed by a **reviewer sub-agent**. **WHEN:** after an engineer signals `review`. Accepts a slash command, natural language, or both. **BOUNDARY:** review only — do not include delivery actions (like posting to a PR or updating tickets). Those belong in `[delivery.goal]`. Empty = built-in reviewer persona. |
| `how_to_determine_if_review_passed` | `""` | **WHO:** evaluated by the **goal orchestrator** against reviewer output. Criteria for pass/fail — the orchestrator is the judge, not the reviewer. Empty = parse `VERDICT: approved` from `.worker-feedback`. |
| `max_rounds` | `3` | Maximum review iterations before escalating to a human. |

**Example — custom review tool with strict rules:**

```toml
[review.dev]
review_instructions = "/ocr:review — focus on security and type safety"
max_rounds = 2
```

---

### `[review.goal]` — Goal-Level Review

The long review cycle. Runs after all beads are merged into the goal branch. Optional — leave empty to skip straight to delivery.

| Key | Default | Description |
|-----|---------|-------------|
| `review_instructions` | `""` | **WHO:** executed by a **reviewer sub-agent**. **WHEN:** after all beads complete, before delivery. **BOUNDARY:** review only — do not include delivery actions (like posting to a PR or transitioning tickets). Those belong in `[delivery.goal]`. Empty = skip goal-level review. |
| `how_to_determine_if_review_passed` | `""` | **WHO:** evaluated by the **goal orchestrator** against reviewer output. Same semantics as `[review.dev]`. Empty = parse `VERDICT: approved`. |
| `how_to_address_review_feedback` | `""` | **WHO:** read by the **goal orchestrator** when creating corrective beads. Describes how engineers should fix rejected work. |
| `max_rounds` | `3` | Maximum goal-level review iterations before escalating. |

**Example:**

```toml
[review.goal]
review_instructions = "/ocr:review"
how_to_address_review_feedback = "Create new beads for each piece of feedback. Reference the original review."
max_rounds = 2
```

---

### `[branching]` — Branch Naming Strategy

| Key | Default | Description |
|-----|---------|-------------|
| `strategy` | `""` | Natural language branch naming preference. Empty = `feat/`, `fix/`, `task/` prefixes, plus ticket ID if available. |

**Example:**

```toml
[branching]
strategy = "Use JIRA ticket as prefix, e.g., PROJ-123/fix-auth-bug"
```

---

### `[worktree]` — Worktree Setup

Controls project-specific bootstrapping that runs automatically when any new worktree is created.

| Key | Default | Description |
|-----|---------|-------------|
| `setup_instructions` | `""` | **WHO:** executed by the **agent entering the worktree** (engineer, goal orchestrator, or project orchestrator — not a sub-agent). **WHEN:** FIRST action after the agent starts, BEFORE reading its assignment or investigating the codebase. Describes project-specific bootstrapping steps — dependency installation, environment file copying, code generation, local database setup, etc. Supports `{project_root}` placeholder, which resolves to the absolute path of the registered project root. **BOUNDARY:** setup only — do not include assignment content, planning directives, review instructions, or delivery actions. Those belong in their respective sections. Empty = no worktree setup (agents start work immediately). |

**Example — monorepo with Prisma:**

```toml
[worktree]
setup_instructions = "Run pnpm install. Copy .env and .env.local from {project_root}. Run npx prisma generate."
```

**Example — conditional setup:**

```toml
[worktree]
setup_instructions = "If package.json exists, run npm ci. If requirements.txt exists, run pip install -r requirements.txt."
```

---

### `[delivery.goal]` — Delivery Pipeline

Controls what happens when a goal is complete. See [Core Concepts: The Lifecycle](concepts.md#the-lifecycle).

| Key | Default | Description |
|-----|---------|-------------|
| `on_completion_instructions` | `""` | **WHO:** executed by the **goal orchestrator** directly (not a sub-agent). **WHEN:** after all beads complete and goal review passes. Describes the delivery pipeline — push, PR, ticket updates, archival, etc. **BOUNDARY:** these are actions to execute. If you want to notify the user with results (like a PR URL), include that as the last step here — do not put notification instructions in `when_to_involve_user_in_delivery`. Empty = present the goal branch for manual inspection (no auto-delivery). |
| `when_to_involve_user_in_delivery` | `""` | **WHO:** evaluated by the **goal orchestrator**. **WHEN:** before executing `on_completion_instructions`. This is a **gate** (when to pause for user approval), not an action field. Do not put post-delivery behavior here — that belongs in `on_completion_instructions`. Empty = `"always"`. |

**Example — auto-PR to develop:**

```toml
[delivery.goal]
on_completion_instructions = "Push the goal branch and create a PR targeting develop"
when_to_involve_user_in_delivery = "never"
```

---

### `[tickets]` — Ticket Integration

| Key | Default | Description |
|-----|---------|-------------|
| `strategy` | `""` | **WHO:** interpreted by **goal and project orchestrators**. **WHEN:** throughout the goal lifecycle (start, progress, completion, blocked). Natural language ticket integration strategy describing how to keep external ticket trackers in sync. **BOUNDARY:** handles lifecycle-wide ticket updates. One-time delivery ticket actions (like "move to In Code Review when PR is created") can go in `on_completion_instructions` instead to avoid duplication. Empty = do not touch tickets. Requires the project to have a skill or MCP for the ticketing system. |

**Example:**

```toml
[tickets]
strategy = "Add a comment to Linear issues with the goal branch name"
```

---

### `[notifications]` — OS Notifications

| Key | Default | Description |
|-----|---------|-------------|
| `system` | `false` | `true` = send OS notifications (`terminal-notifier` on macOS, `notify-send` on Linux). |
| `sound` | `false` | `true` = play an audible alert with notifications. |

---

### `[updates]` — Version Awareness

| Key | Default | Description |
|-----|---------|-------------|
| `check_on_launch` | `true` | `false` = disable the update check when orc starts. |

---

### `[agents]` — Agent Enhancements

| Key | Default | Description |
|-----|---------|-------------|
| `ruflo` | `"off"` | Ruflo integration: `"off"` (disabled), `"auto"` (use when available), `"require"` (fail if unavailable). |

---

### `[layout]` — tmux Pane Management

Controls when orc creates overflow windows instead of adding more panes.

| Key | Default | Description |
|-----|---------|-------------|
| `min_pane_width` | `40` | Minimum pane width in columns before creating an overflow window. |
| `min_pane_height` | `10` | Minimum pane height in rows before creating an overflow window. |

---

### `[board]` — Board Visualization

| Key | Default | Description |
|-----|---------|-------------|
| `command` | `""` | Custom board command. Empty = built-in fallback (`watch bd list`). |

---

### `[theme]` — tmux Visual Theme

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | `false` = respect your existing tmux theme; only set functional options. |
| `mouse` | `true` | `false` = do not override mouse setting (only applies when theme is enabled). |
| `accent` | `"#00ff88"` | Primary accent color — status bar, active borders, current window. |
| `bg` | `"#0d1117"` | Status bar background. |
| `fg` | `"#8b949e"` | Status bar text. |
| `border` | `"#30363d"` | Inactive pane and window borders. |
| `muted` | `"#6e7681"` | De-emphasized text (version info, separators). |
| `activity` | `"#d29922"` | Window activity highlight color. |

---

## Common Recipes

### OpenSpec Planning + PR Delivery

Full planning lifecycle with formal specs, automatic PR creation on completion.

```toml
[planning.goal]
plan_creation_instructions = "/openspec:proposal"
bead_creation_instructions = "Decompose beads from tasks.md. Each bead maps to one or more task items."
when_to_involve_user_in_plan = "always"

[delivery.goal]
on_completion_instructions = "Push the goal branch, create a PR targeting main, archive the openspec change"
when_to_involve_user_in_delivery = "when the PR targets main"
```

### Fully Autonomous Pipeline (YOLO + Auto-Delivery)

No human gates. Engineers auto-accept tool use, reviews run automatically, delivery proceeds without confirmation. Use with caution.

```toml
[defaults]
yolo_flags = "--dangerously-skip-permissions"

[approval]
ask_before_dispatching = "auto"
ask_before_reviewing = "auto"
ask_before_merging = "auto"

[delivery.goal]
on_completion_instructions = "Push the goal branch and create a PR targeting develop"
when_to_involve_user_in_delivery = "never"
```

### Conservative (Ask Everything)

Maximum human oversight. Every gate pauses for confirmation.

```toml
[approval]
ask_before_dispatching = "ask"
ask_before_reviewing = "ask"
ask_before_merging = "ask"

[planning.goal]
when_to_involve_user_in_plan = "always"

[delivery.goal]
when_to_involve_user_in_delivery = "always"
```

### Worktree With Environment Files

Copy environment files and install dependencies so every engineer starts with a working environment.

```toml
[worktree]
setup_instructions = """
Copy .env and .env.local from {project_root} to this directory.
Run pnpm install.
Run npx prisma generate.
"""
```

### Custom Review Tool

Plug in your own review tool at both the bead and goal level.

```toml
[review.dev]
review_instructions = "/ocr:review — focus on security, performance, and type safety"
max_rounds = 2

[review.goal]
review_instructions = "/ocr:review"
how_to_address_review_feedback = "Create targeted beads for each review finding. Reference the original feedback."
max_rounds = 2
```
