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
| `agent_cmd` | `"claude"` | CLI to launch: `claude`, `opencode`, `codex`, `gemini`, or any custom CLI. Adapters at `packages/cli/lib/adapters/{name}.sh` handle CLI-specific behavior. |
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

| Key | Default | Description |
|-----|---------|-------------|
| `plan_creation_instructions` | `""` | How to create the plan — given to a planner sub-agent after investigation. Can be a slash command, natural language, or both. Empty = skip planning. |
| `bead_creation_instructions` | `""` | How to create beads from plan artifacts. Project-specific decomposition conventions. Empty = goal orchestrator uses default judgment. |
| `when_to_involve_user_in_plan` | `""` | When to pause for user review before decomposing. Empty = `"always"`. |

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
| `assignment_instructions` | `""` | Included in every engineer's assignment. Applied to all dispatches, whether from a plan or direct decomposition. Empty = goal orchestrator uses default judgment. |

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
| `review_instructions` | `""` | How to perform the review — a slash command, natural language, or both. Empty = built-in reviewer persona. |
| `how_to_determine_if_review_passed` | `""` | How to parse the review result. Empty = parse `VERDICT: approved` from `.worker-feedback`. |
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
| `review_instructions` | `""` | How to perform the goal-level review. Empty = skip goal-level review. |
| `how_to_determine_if_review_passed` | `""` | How to parse the review result. Empty = parse `VERDICT: approved`. |
| `how_to_address_review_feedback` | `""` | How engineers should address rejection feedback from goal-level review. |
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

### `[delivery.goal]` — Delivery Pipeline

Controls what happens when a goal is complete. See [Core Concepts: The Lifecycle](concepts.md#the-lifecycle).

| Key | Default | Description |
|-----|---------|-------------|
| `on_completion_instructions` | `""` | What to do when a goal is complete. Natural language or slash command. Empty = signal review to project orchestrator. |
| `when_to_involve_user_in_delivery` | `""` | When to pause for user approval before executing delivery. Empty = `"always"`. |

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
| `strategy` | `"Move tickets to 'In Development' when goals start, and 'Ready for Code Review' when goals are complete"` | Natural language ticket integration strategy. Empty = do not touch tickets. Requires the project to have a skill or MCP for the ticketing system. |

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
