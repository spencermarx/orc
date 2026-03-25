# Migration Changelog

Complete migration guide for orc. Each version section contains everything needed to update a user's local setup — breaking changes, new capabilities, and new commands. Used by `orc doctor --interactive` for agent-assisted migration.

<!-- ENTRY FORMAT — for AI assistants editing this file:

Update this file whenever a change: removes/renames config fields, adds new config sections or CLI commands, changes existing behavior, or adds prerequisites.

Entry types (in order within each version):

1. BREAKING CHANGES (required migration):
   ### `[old]` → `[new]` — Mechanical|Semantic Migration
   **Removed/Replacement/Why/Migration (with examples)/Classification**
   - Mechanical = value unchanged, rename only → `orc doctor --fix`
   - Semantic = value needs transformation → `orc doctor --interactive`

2. NEW CAPABILITIES (recommended setup):
   ### New: `[section]` — Brief Description
   **Fields/What it does/Default (unconfigured)/Setup**

3. NEW COMMANDS:
   ### New command: `orc <cmd>`
   **What it does/Usage**

Always include "Why", concrete examples, default behavior, and reference `orc doctor`/`orc setup` where applicable. -->

---

## v0.2.9 — Project Orchestrator Isolation, Config Guard & Worktree Setup Hook (2026-03-25)

### Breaking Changes

None.

### New Capabilities

#### Project orchestrator worktree isolation

**What:** The project orchestrator now runs in an isolated worktree (`.worktrees/.project-orch`) instead of the developer's main workspace. Sub-agents (scouts) inherit this isolation, preventing accidental file creation, staging, or modification in the main working tree. Goal orchestrators already had this isolation; this brings the project orchestrator to parity.

**Why:** During live runs, project orchestrator sub-agents were creating files (openspec proposals, application code) and even staging changes in the main worktree. Behavioral boundaries ("never write code") were insufficient without structural enforcement.

**Migration:** No action needed. The worktree is created automatically on next `orc <project>` launch and cleaned up by `orc teardown <project>`.

#### Config modification guard

**What:** Orchestrators and goal orchestrators are now explicitly prohibited from modifying `.orc/config.toml` or other configuration files. The `/orc:dispatch` command no longer suggests increasing `max_workers` directly — it emits a `CAPACITY` notification instead, prompting the user to adjust config via `orc config` or `orc setup`.

**Why:** A goal orchestrator followed dispatch command instructions to "increase `max_workers` in config" and directly edited `.orc/config.toml` without user approval.

**Migration:** No action needed. Behavioral change only — personas and commands updated.

#### New: `[worktree]` — Worktree Setup Hook

**Fields:** `setup_instructions`

**What it does:** Defines project-specific bootstrapping that runs as the FIRST action when any new worktree is created — for engineers, goal orchestrators, and project orchestrators. The agent entering the worktree executes these instructions before reading its assignment or investigating the codebase.

**Default (unconfigured):** No worktree setup. Agents start work immediately (today's behavior).

**Setup:** `orc setup <project>` or add manually:

```toml
[worktree]
setup_instructions = """
Run pnpm install.
Copy .env and .env.local from {project_root} to this worktree.
Run npx prisma generate.
"""
```

**Placeholder:** `{project_root}` is replaced with the absolute path to the registered project root at launch time. Use this to reference files that should be copied from the main project directory.

---

## v0.2.8 — Signal File Git-Exclude Guard (2026-03-24)

### Breaking Changes

None.

### New Capabilities

#### Git-exclude patterns for signal files

**What:** `.worker-status`, `.worker-feedback`, and `.orch-assignment.md` are now added to `.git/info/exclude` for all registered projects. Previously only directory patterns (`.beads/`, `.worktrees/`, `.goals/`) were excluded, which did not protect signal files inside engineer worktrees (where they sit at the worktree root, not inside `.worktrees/`).

**Why:** Engineers running `git add .` or `git add -A` could accidentally stage and commit orc orchestration internals.

**Migration:** Run `orc doctor --fix` to add the missing patterns to existing projects. New projects registered via `orc add` get them automatically.

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

**Classification:** Semantic — requires user decision. Use `orc doctor --interactive`.

---

#### `[review.dev]` and `[review.goal]` field renames — Mechanical Migration

**Removed:** `verify_approval`, `address_feedback`
**Replacement:** `how_to_determine_if_review_passed`, `how_to_address_review_feedback`

**Why:** Self-documenting field names that read like the question being answered.

**Migration:**
- `verify_approval = "<value>"` → `how_to_determine_if_review_passed = "<value>"` (value unchanged)
- `address_feedback = "<value>"` → `how_to_address_review_feedback = "<value>"` (value unchanged)

**Classification:** Mechanical — direct rename. Use `orc doctor --fix`.

---

#### `[approval]` field renames — Mechanical Migration

**Removed:** `spawn`, `review`, `merge`
**Replacement:** `ask_before_dispatching`, `ask_before_reviewing`, `ask_before_merging`

**Why:** Self-documenting field names. "Ask before dispatching?" reads naturally vs. "spawn."

**Migration:**
- `spawn = "<value>"` → `ask_before_dispatching = "<value>"` (value unchanged)
- `review = "<value>"` → `ask_before_reviewing = "<value>"` (value unchanged)
- `merge = "<value>"` → `ask_before_merging = "<value>"` (value unchanged)

**Classification:** Mechanical — direct rename. Use `orc doctor --fix`.

---

### New Capabilities

#### New: Self-Documenting Config Schema

**What it does:** Every lifecycle hook field in `config.toml` now has structured WHO / WHEN / WHAT / BOUNDARY comments that document who executes the field, when it fires, what belongs in it, and what does NOT belong. `orc setup` and `orc doctor --interactive` read these comments to correctly assemble and validate config values.

**Default (unconfigured):** No action needed. The comments are in the committed defaults.

**Impact:** Setup agents produce correct configs by respecting field boundaries. Doctor agents validate field VALUES (not just names) against documented boundaries.

---

#### New: `orc doctor` Accepts Project Argument

**What it does:** `orc doctor [project] [--fix|--interactive]` now accepts an optional project name to scope validation and review to a specific project.

**Usage:** `orc doctor wrkbelt --interactive` reviews only wrkbelt's config.

---

#### Changed: Bash 3.2+ Minimum (was 4+)

**What changed:** `orc doctor` was rewritten to avoid bash 4+ features (`declare -A`). All orc scripts now run on bash 3.2+ (macOS default).

**Impact:** No need to install a newer bash. Orc works out of the box on macOS.

---

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

#### `orc doctor [--fix|--interactive]`

**What it does:** Validates config files against the current schema. Three modes:
- `orc doctor` — fast validation, reports issues
- `orc doctor --fix` — applies mechanical renames automatically
- `orc doctor --interactive` — interactive agent-assisted migration via root orchestrator

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
