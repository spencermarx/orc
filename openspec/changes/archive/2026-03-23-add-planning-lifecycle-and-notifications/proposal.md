# Change: Add Lifecycle Hooks, Notification System, and Config Validation

## Why

Orc's work sequence has key lifecycle moments — planning, review, and delivery — but they're configured inconsistently: review uses natural-language hook fields, delivery uses a rigid enum mode switch, planning has no touchpoint at all, and there's no push-based mechanism to alert users when their input is needed. Additionally, orc has no way to validate user config against the current schema or notify users when a newer version is available.

High-performing teams need to configure each lifecycle phase with their own tools and workflows, be pulled in at the right moments, and have engineers who can ask questions back up to their lead. This change establishes lifecycle hooks as a first-class architectural concept with a consistent pattern across all phases, adds a notification system, introduces config validation, and adds update awareness.

## What Changes

### Lifecycle Hooks — Consistent Pattern Across All Phases

Establishes a unified configuration pattern: each lifecycle phase has **"what to do"** (instructions) and **"when to involve the user"** (involvement criteria), both expressed as natural language interpreted by the agent.

**Planning (`[planning.goal]`)** — new section:
- `plan_creation_instructions` — what tool/approach creates the plan (delegates to planner sub-agent)
- `bead_creation_instructions` — how the goal orchestrator should create beads from plan artifacts (project-specific conventions for decomposition)
- `when_to_involve_user_in_plan` — when to pause for user review before decomposition

**Dispatch (`[dispatch.goal]`)** — new section:
- `assignment_instructions` — what to include in every engineer's assignment, regardless of planning. Applied universally to all dispatches.

**Review (`[review.dev]`, `[review.goal]`)** — field renames for clarity:
- `review_instructions` — unchanged (already clear)
- `verify_approval` → **`how_to_determine_if_review_passed`** — how the orchestrator evaluates whether the review passed
- `address_feedback` → **`how_to_address_review_feedback`** — how engineers should handle rejection
- `max_rounds` — unchanged (self-explanatory)

**Approval (`[approval]`)** — field renames for clarity:
- `spawn` → **`ask_before_dispatching`**
- `review` → **`ask_before_reviewing`**
- `merge` → **`ask_before_merging`**
- Values (`"ask"` / `"auto"`) are unchanged. Approval gates operate at a different layer than lifecycle hooks — they control *whether the user confirms* operational actions, while lifecycle hooks control *what happens* at each workflow phase.

**Delivery (`[delivery.goal]`)** — replaces `[delivery]`:
- `on_completion_instructions` — what to do when a goal is complete (push, PR, ticket update, archive specs, notify Slack, etc.)
- `when_to_involve_user_in_delivery` — when to pause for user approval before executing delivery
- **Replaces** `[delivery] mode` and `[delivery] target_strategy` entirely (clean cutover, no deprecation)

### Supporting Capabilities

- **Planner persona** — new `packages/personas/planner.md` ephemeral sub-agent that creates planning artifacts on behalf of the goal orchestrator (same pattern as scouts and reviewers).
- **Engineer `question:` status signal** — new `.worker-status` value for engineers to ask clarifying questions about the plan or assignment. Goal orchestrator answers via `.worker-feedback`, involving the user when it can't answer independently.
- **Notification system** — condition-based (not event-based) notification model with auto-resolution. Append-only log, tmux status bar showing active condition count, window-level and pane-level visual indicators highlighting where attention is needed, and `orc notify` CLI command with interactive navigation to the relevant pane. Notifications fire at lifecycle moments and auto-resolve when agents clear the underlying condition — the user never manually dismisses.
- **Plan invalidation loop** — when engineers discover plan assumptions are wrong (via `found: plan-issue`), the goal orchestrator re-engages the planner and optionally the user.
- **Project config setup** — `orc setup <project>` command that launches the project orchestrator in setup mode. Scouts investigate the project's tools (planning, review, delivery, ticketing, test infrastructure, available skills/MCPs), the project orchestrator converses with the user about their SDLC preferences, and a new **configurator** ephemeral sub-agent assembles a tailored `.orc/config.toml`. The user reviews and approves before it's written.
- **Config validation and migration** — `orc doctor` CLI command with three modes: fast bash validation (`orc doctor`), mechanical auto-fix for field renames (`orc doctor --fix`), and interactive agent-assisted migration (`orc doctor --interactive`) that launches the root orchestrator to converse with the user, understand project context via sub-agents, and delegate config changes to project orchestrators. Backed by `migrations/CHANGELOG.md` as the agent's migration guide.
- **Update awareness** — pre-step on `orc` launch that checks if the local repo is behind `origin/main`, notifying the user when a newer version is available.

## Impact

- Affected specs: planning-lifecycle (new), delivery-lifecycle (new), planner-persona (new), notification-system (new), project-config-setup (new), config-validation (new), update-awareness (new)
- Affected code:
  - `config.toml` — new `[planning.goal]`, `[dispatch.goal]`, `[delivery.goal]`, `[notifications]` sections; renamed review fields; removed old `[delivery]` section
  - `packages/personas/goal-orchestrator.md` — planning hook integration, planner delegation, question handling, delivery hook integration
  - `packages/personas/planner.md` — new persona
  - `packages/personas/configurator.md` — new persona
  - `packages/personas/engineer.md` — plan context consumption, `question:` signal
  - `packages/cli/lib/setup.sh` — new subcommand
  - `packages/commands/_canonical/plan.md` — planning hook integration
  - `packages/commands/_canonical/check.md` — notification emission, question detection
  - `packages/commands/_canonical/complete-goal.md` — delivery hook integration, replaces hardcoded mode switch
  - `packages/cli/lib/_common.sh` — `_orc_notify` helper, renamed review config field reads, delivery helpers updated
  - `packages/cli/lib/notify.sh` — new subcommand
  - `packages/cli/lib/doctor.sh` — new subcommand (config validation)
  - `packages/cli/bin/orc` — route `notify` and `doctor` subcommands, update awareness pre-step
  - `packages/cli/lib/status.sh` — notification count in status output
  - tmux status bar format — notification indicator widget
- Affected tiers: Goal orchestrator (primary), project orchestrator (monitors delivery), engineer (consumes plan context, asks questions), root orchestrator (sees notifications)
