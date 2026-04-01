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

## v0.2.14 — Window Chooser & Compact Tabs (2026-03-31)

### New Capabilities

#### New: Compact tab display names

Goal window tabs now show abbreviated names instead of full window names. Jira-style ticket prefixes (e.g., `WEN-949`) are auto-extracted; other goal names are truncated to 12 characters. Short names are stored as `@orc_short` tmux user options and rendered via `window-status-format`. Falls back to full name (`#W`) for windows without `@orc_short`.

No configuration needed — active whenever `tui.enabled = true`.

#### New: Window chooser popup (`Prefix + w`)

Hierarchical tree view popup showing all windows grouped by project with live status indicators. Uses fzf-tmux for fuzzy search and navigation. Falls back to tmux `choose-tree` when fzf is not installed.

**Keybindings:**
- `Prefix + w` — always available when TUI enabled
- `Alt + w` — available when `keybindings.enabled = true` (configurable via `keybindings.chooser`)

#### New: `keybindings.chooser` field

Configures the Alt+ shortcut for the window chooser (default `M-w`). Only active when `keybindings.enabled = true`.

---

## v0.2.13 — Theme Redesign & Splash Screen (2026-03-30)

### New Capabilities

#### New: Theme engine with Nerd Font support

Pill-shaped window tabs using powerline glyphs (auto-detected via `fc-list`). Theme is generated as a temp `.conf` and sourced by tmux — Nerd Font glyphs embedded as literal UTF-8, no shell escaping. Falls back to plain text tabs without Nerd Font.

**New fields:**
- `theme.error` — error/blocked state color (default `#f85149`)
- `theme.tab_bg` — inactive tab background (default `#161b22`)
- `theme.bg_highlight` — raised surface bg for palette/popups (default `#1c2128`)
- `theme.separator_style` — separator glyphs: `powerline`, `rounded`, `slant`, `plain` (default `rounded`)
- `theme.nerd_font` — Nerd Font detection: `auto`, `on`, `off` (default `auto`)

#### New: Branded splash screen

ASCII orc face + ORC logo displayed on first session creation. Centered, green-tinted, dismissed on keypress. Controlled by `tui.show_splash` (default `true`).

#### Changed: Help overlay

Added tmux basics reference, status icons legend, and roles section.

#### Changed: Command palette

fzf colors now use hex theme values for full theme awareness.

#### Changed: Status bar

Health groups separated by `│` dividers. Error color config-driven.

---

## v0.2.12 — Border Styling & System Prompt Delivery (2026-03-30)

### New Capabilities

#### New: `[theme]` border styling fields

**Fields:**
- `theme.border_style` (string, default `"single"`) — pane border line style: `"single"`, `"heavy"`, `"double"`, `"simple"`
- `theme.pane_indicators` (string, default `"colour"`) — active pane indicator: `"off"`, `"colour"`, `"arrows"`, `"both"`
- `theme.popup_border_style` (string, default `"rounded"`) — popup border line style: `"single"`, `"rounded"`, `"heavy"`, `"double"`, `"simple"`, `"padded"`, `"none"`

**What it does:** Configures tmux pane and popup border appearance. Pane borders get bold title labels. Active pane uses colour indicators by default. Popups (help overlay, command palette) use rounded corners.

**Default (unconfigured):** Single pane borders with colour indicators, rounded popup borders. No action needed.

#### Changed: Agent prompt delivery

Task instructions (initial_prompt) are now merged into the system prompt instead of appearing as a visible user message. Agents see a minimal "Begin." kickoff message. No config changes required — this is an internal behavioral change.

---

## v0.2.11 — TUI Navigation Layer (2026-03-26)

### New Capabilities

#### New: `[tui]` — Navigation overlay for tmux

**Fields:**
- `tui.enabled` (boolean, default `true`) — master toggle for all TUI enhancements
- `tui.breadcrumbs` (boolean, default `true`) — hierarchy breadcrumb in status-left: `⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2`
- `tui.show_help_hint` (boolean, default `true`) — subtle help hint in status-right for new users
- `tui.palette.enabled` (boolean, default `true`) — command palette via `Prefix+Space`
- `tui.palette.show_preview` (boolean, default `true`) — live pane preview when browsing palette
- `tui.menu.enabled` (boolean, default `true`) — context menu via `Prefix+m` / right-click

**What it does:** Adds a navigation overlay on top of tmux with four layers: breadcrumb status bar, context menus, command palette (fuzzy search), and optional keybindings. All features are additive and individually toggleable. Set `tui.enabled = false` for raw tmux.

**Always-on when TUI enabled:** Prefix mode indicator (visual flash when Ctrl+b pressed) and enriched window tabs (engineer count in goal windows). These have no individual toggles.

**Default (unconfigured):** All features active. Palette uses fzf if available, falls back to tmux `choose-tree` without it.

**Setup:** No setup required — works out of the box. Run `orc doctor` for fzf recommendation.

#### New: `[keybindings]` — Prefix-free Alt+ shortcuts

**Fields:**
- `keybindings.enabled` (boolean, default `false`) — opt-in master toggle
- `keybindings.project` (string, default `"M-0"`) — jump to project orchestrator
- `keybindings.dashboard` (string, default `"M-s"`) — jump to status dashboard
- `keybindings.prev` (string, default `"M-["`) — previous window
- `keybindings.next` (string, default `"M-]"`) — next window
- `keybindings.palette` (string, default `"M-p"`) — open command palette
- `keybindings.menu` (string, default `"M-m"`) — open context menu
- `keybindings.help` (string, default `"M-?"`) — help overlay

**What it does:** Registers prefix-free Alt+ shortcuts for fast navigation. Disabled by default to avoid conflicts with terminal emulators. Each key is individually overridable or disableable (set to `""`).

**Default (unconfigured):** Disabled. Only prefix-based bindings are active (`Prefix+Space`, `Prefix+m`, `Prefix+?`).

**Setup:** Set `keybindings.enabled = true` in config. iTerm2 users: set "Option key sends +Esc" in Preferences > Profiles > Keys. `orc doctor` warns about this.

### New Scripts

- `packages/cli/lib/palette.sh` — command palette (fzf + choose-tree fallback)
- `packages/cli/lib/menu.sh` — role-aware context menu (tmux display-menu)
- `packages/cli/lib/menu-action.sh` — menu action callback with safety validation
- `packages/cli/lib/help.sh` — help overlay (tmux display-popup)

### Dependencies

- **fzf** (optional) — enables fuzzy search in command palette. Without fzf, palette falls back to tmux `choose-tree`. Install: `brew install fzf`

---

## v0.2.8 — Isolation, Config Guard, Worktree Setup Hook & Add-Setup Flow (2026-03-25)

### Breaking Changes

None.

### Behavioral Changes

#### `orc add` now prompts to launch guided config setup

**What:** After registering a project, `orc add` now prompts `"Run guided config setup now? [Y/n]"` instead of printing a suggestion to run `orc setup` manually. Pressing Enter (or Y) launches `orc setup <project>` immediately. Typing N skips setup with a reminder message.

**Why:** The previous two-command flow (`orc add` then `orc setup`) was unnecessary friction — users frequently forgot to run setup, leading to unconfigured projects.

**`--yolo` behavior:** In yolo mode, the prompt is skipped and setup launches automatically — consistent with yolo semantics throughout orc.

**Migration:** No action needed. `orc setup <project>` continues to work independently for reconfiguration.

#### `orc doctor` flag renames: `--auto-fix`/`--fix` → `--fix`/`--interactive`

**What:** `orc doctor --auto-fix` is now `orc doctor --fix`. `orc doctor --fix` (the old interactive mode) is now `orc doctor --interactive`.

**Why:** Clearer semantics — `--fix` applies mechanical renames, `--interactive` launches agent-assisted migration.

**Migration:** Update any scripts or muscle memory. Old flags are removed.

### New Capabilities

#### Git-exclude patterns for signal files

**What:** `.worker-status`, `.worker-feedback`, and `.orch-assignment.md` are now added to `.git/info/exclude` for all registered projects. Previously only directory patterns (`.beads/`, `.worktrees/`, `.goals/`) were excluded, which did not protect signal files inside engineer worktrees (where they sit at the worktree root, not inside `.worktrees/`).

**Why:** Engineers running `git add .` or `git add -A` could accidentally stage and commit orc orchestration internals.

**Migration:** Run `orc doctor --fix` to add the missing patterns to existing projects. New projects registered via `orc add` get them automatically.

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

#### Auto agent CLI detection

**What:** `agent_cmd = "auto"` (new default) detects installed agent CLIs in priority order: `claude` → `opencode` → `codex` → `gemini`. Removes the need to manually set the agent command.

**Why:** Users installing orc for the first time shouldn't have to know which config field to set for their CLI.

**Migration:** No action needed. Existing `agent_cmd` values continue to work. `"auto"` is the new default for unconfigured projects.

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
