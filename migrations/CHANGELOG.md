# Migration Changelog

Complete migration guide for orc. Each version section contains everything needed to update a user's local setup — breaking changes, new capabilities, and new commands. Used by `orc doctor --fix` for agent-assisted migration.

<!-- ENTRY FORMAT — for AI assistants editing this file:

Update this file whenever a change: removes/renames config fields, adds new config sections or CLI commands, changes existing behavior, or adds prerequisites.

Entry types (in order within each version):

1. BREAKING CHANGES (required migration):
   ### `[old]` → `[new]` — Mechanical|Semantic Migration
   **Removed/Replacement/Why/Migration (with examples)/Classification**
   - Mechanical = value unchanged, rename only → `orc doctor --auto-fix`
   - Semantic = value needs transformation → `orc doctor --fix`

2. NEW CAPABILITIES (recommended setup):
   ### New: `[section]` — Brief Description
   **Fields/What it does/Default (unconfigured)/Setup**

3. NEW COMMANDS:
   ### New command: `orc <cmd>`
   **What it does/Usage**

Always include "Why", concrete examples, default behavior, and reference `orc doctor`/`orc setup` where applicable. -->

---

## v0.2 — Lifecycle Hooks, Notifications, and Config Tooling (2026-03-23)

### Breaking Changes

#### `[delivery]` → `[delivery.goal]` — Semantic Migration

**Removed:** `mode`, `target_strategy`
**Replacement:** `on_completion_instructions`, `when_to_involve_user_in_delivery`

**Why:** Delivery is now a lifecycle hook with natural-language instructions, replacing the rigid review/PR mode switch. Users describe their full delivery pipeline instead of choosing between two modes.

**Migration:**
- `mode = "review"` (or empty) → leave `on_completion_instructions` empty (same behavior)
- `mode = "pr"` → `on_completion_instructions = "push the goal branch and create a PR targeting <branch>"`
  - Incorporate `target_strategy` value: e.g., `"target develop"` → `"push the goal branch and create a PR targeting develop"`
  - Conditional logic (e.g., "develop for features, main for hotfixes") → express in natural language
- `when_to_involve_user_in_delivery` defaults to `"always"` — set to `"never"` for auto-delivery

**Classification:** Semantic — requires user decision. Use `orc doctor --fix`.

---

#### `[review.dev]` and `[review.goal]` field renames — Mechanical Migration

**Removed:** `verify_approval`, `address_feedback`
**Replacement:** `how_to_determine_if_review_passed`, `how_to_address_review_feedback`

**Why:** Self-documenting field names that read like the question being answered.

**Migration:**
- `verify_approval = "<value>"` → `how_to_determine_if_review_passed = "<value>"` (value unchanged)
- `address_feedback = "<value>"` → `how_to_address_review_feedback = "<value>"` (value unchanged)

**Classification:** Mechanical — direct rename. Use `orc doctor --auto-fix`.

---

#### `[approval]` field renames — Mechanical Migration

**Removed:** `spawn`, `review`, `merge`
**Replacement:** `ask_before_dispatching`, `ask_before_reviewing`, `ask_before_merging`

**Why:** Self-documenting field names. "Ask before dispatching?" reads naturally vs. "spawn."

**Migration:**
- `spawn = "<value>"` → `ask_before_dispatching = "<value>"` (value unchanged)
- `review = "<value>"` → `ask_before_reviewing = "<value>"` (value unchanged)
- `merge = "<value>"` → `ask_before_merging = "<value>"` (value unchanged)

**Classification:** Mechanical — direct rename. Use `orc doctor --auto-fix`.

---

### New Capabilities

#### New: Goal Orchestrator Worktree Isolation

**What it does:** Goal orchestrators now run in dedicated git worktrees at `.worktrees/goal-<name>`, checked out to the goal branch. Previously they shared the project root, which caused workspace contamination when multiple goals ran concurrently.

**Default (unconfigured):** Automatic. Every `orc spawn-goal` creates a worktree. No config needed.

**Impact:** The developer's main workspace stays clean on its current branch. Planners and scouts run in the goal worktree. Teardown removes goal worktrees automatically.

---

#### New: `[planning.goal]` — Plan Creation and Bead Decomposition

**Fields:** `plan_creation_instructions`, `bead_creation_instructions`, `when_to_involve_user_in_plan`

**What it does:** Configures the planning lifecycle at goal level — what tool creates the plan, how plan artifacts become beads, and when the user reviews the plan. Delegates plan creation to a new planner sub-agent.

**Default (unconfigured):** No planning phase. Goal orchestrator decomposes directly from scout findings (today's behavior).

**Setup:** `orc setup <project>` discovers planning tools automatically, or add manually:
```toml
[planning.goal]
plan_creation_instructions = "/openspec:proposal"
bead_creation_instructions = "Decompose beads from tasks.md. Each bead maps to one or more task items."
when_to_involve_user_in_plan = "when the plan involves more than 3 beads"
```

---

#### New: `[dispatch.goal]` — Engineer Assignment Briefing

**Fields:** `assignment_instructions`

**What it does:** Controls what every engineer receives in their assignment when dispatched. Applied universally — whether beads came from a plan or direct decomposition.

**Default (unconfigured):** Goal orchestrator uses default judgment (bead description, acceptance criteria, plan context if available).

**Setup:** `orc setup <project>` or add manually:
```toml
[dispatch.goal]
assignment_instructions = """
  Include the full proposal directory path.
  Quote specific tasks verbatim.
  Instruct engineers to read planning docs for full context.
"""
```

---

#### New: `[notifications]` — Push-Based Notifications

**Fields:** `system`, `sound`

**What it does:** Condition-based notification system with auto-resolution. Status bar shows active count, window/pane indicators highlight where attention is needed. `orc notify` provides interactive navigation.

**Default (unconfigured):** Tmux status bar notifications are always active. OS-level notifications and sound are off.

**Setup:**
```toml
[notifications]
system = true    # OS notifications (terminal-notifier on macOS, notify-send on Linux)
sound = true     # Audible alerts
```

---

#### New: `[updates]` — Version Awareness

**Fields:** `check_on_launch`

**What it does:** Checks if the local orc repo is behind `origin/main` on launch. Non-blocking, 2s timeout.

**Default (unconfigured):** Enabled. Set `check_on_launch = false` to disable.

**Setup:**
```toml
[updates]
check_on_launch = true
```

---

#### New: Engineer `question:` Status Signal

**What it does:** Engineers can ask clarifying questions via `question: <text>` in `.worker-status`. The goal orchestrator answers directly or involves the user.

**Default:** Available automatically. Engineers are guided by their persona to investigate first, ask only when stuck.

---

#### New: Planner and Configurator Sub-Agents

**What it does:** Two new ephemeral sub-agent personas:
- **Planner** (`packages/personas/planner.md`) — creates planning artifacts on behalf of the goal orchestrator
- **Configurator** (`packages/personas/configurator.md`) — assembles `.orc/config.toml` during `orc setup`

**Default:** Used automatically when `plan_creation_instructions` is set (planner) or `orc setup` is run (configurator). Customizable via project-level persona overrides (`.orc/planner.md`, `.orc/configurator.md`).

---

### New Commands

#### `orc doctor [--auto-fix|--fix]`

**What it does:** Validates config files against the current schema. Three modes:
- `orc doctor` — fast validation, reports issues
- `orc doctor --auto-fix` — applies mechanical renames automatically
- `orc doctor --fix` — interactive agent-assisted migration via root orchestrator

---

#### `orc notify [--all|--clear|--goto N]`

**What it does:** View and navigate active notifications. Interactive numbered list with tmux pane navigation.
- `orc notify` — show active notifications, select to navigate
- `orc notify --all` — full history
- `orc notify --clear` — force-resolve all
- `orc notify --goto N` — navigate to Nth notification

---

#### `orc setup <project>`

**What it does:** Guided, conversational project config assembly. Scouts the project for available tools, converses about SDLC preferences, and writes a tailored `.orc/config.toml`. Works for initial setup and reconfiguration. Supports `--yolo` for auto-configuration.
