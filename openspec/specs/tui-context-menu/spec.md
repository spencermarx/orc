# tui-context-menu Specification

## Purpose
TBD - created by archiving change add-tui-navigation-layer. Update Purpose after archive.
## Requirements
### Requirement: Context Menu Configuration

The system SHALL support a `[tui.menu]` config section with the following fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Toggle context menu entirely (when `[tui] enabled` is also `true`) |

Right-click menu behavior SHALL follow the existing `theme.mouse` setting — no separate toggle needed. When `theme.mouse` is `true`, right-click opens the context menu. When `theme.mouse` is `false`, only `Prefix + m` opens the menu.

When `tui.menu.enabled` is `false`, the `Prefix + m` and mouse bindings SHALL NOT be registered.

When `[tui] enabled` is `false`, no menu binding SHALL be registered.

#### Scenario: Context menu disabled
- **GIVEN** the user sets `tui.menu.enabled = false`
- **WHEN** the orc tmux session initializes
- **THEN** no `Prefix + m` or right-click bindings for the context menu are registered

#### Scenario: Right-click follows theme.mouse
- **GIVEN** `theme.mouse = false` and `tui.menu.enabled = true`
- **WHEN** the user right-clicks on a pane
- **THEN** no orc context menu appears (mouse is globally disabled)
- **AND** `Prefix + m` still opens the context menu

### Requirement: Context Menu Trigger

The system SHALL bind `Prefix + m` to open a context menu in the orc tmux session (when enabled).

The system SHALL also bind right-click (`MouseDown3Pane`) to open the context menu at the mouse position when `theme.mouse` is `true`.

The menu SHALL render using tmux's native `display-menu` command.

#### Scenario: Keyboard trigger
- **WHEN** the user presses `Prefix + m` in any orc pane
- **THEN** a context menu appears with actions relevant to the current pane's role

#### Scenario: Mouse trigger
- **GIVEN** `theme.mouse` is `true` and context menu is enabled
- **WHEN** the user right-clicks on an orc pane
- **THEN** a context menu appears at the mouse position
- **AND** the menu content matches what `Prefix + m` would show for that pane

#### Scenario: Menu dismissed
- **WHEN** the user presses Escape or clicks outside the menu
- **THEN** the menu closes with no action taken

### Requirement: Role-Aware Menu Content

The context menu SHALL detect the current pane's role using the `@orc_id` user option and pane title, and display role-appropriate actions.

Each menu item SHALL have a single-key shortcut for keyboard selection.

Menu items SHALL be visually grouped into safety tiers separated by `display-menu` separator lines:
- **Navigation tier** (top): focus changes and read-only popups — no marker
- **Orchestration tier** (middle): slash commands sent to agent panes — prefixed with `▸`
- **Common tier** (bottom): palette, help — always present

**Project/Root Orchestrator panes** SHALL show: go to status, go to board (navigation); check workers, dispatch ready work (orchestration); command palette, help (common).

**Goal Orchestrator panes** SHALL show: go to project orchestrator, go to status (navigation); check engineers, dispatch beads (orchestration); complete goal — with `confirm-before` (destructive/confirmed); command palette, help (common).

**Engineer panes** SHALL show: go to goal orchestrator, go to project orchestrator, go to status (navigation); mark done, signal blocked, read feedback (orchestration); command palette, help (common).

**Reviewer panes** SHALL show: go to goal orchestrator, go to engineer, go to status (navigation); command palette, help (common).

**Unrecognized panes** SHALL show: command palette, help (common).

#### Scenario: Engineer context menu
- **GIVEN** the active pane has `@orc_id` matching `eng:*`
- **WHEN** the user opens the context menu
- **THEN** the menu shows navigation items (go to goal orch, project orch, status), a separator, orchestration items prefixed with `▸` (mark done, signal blocked, read feedback), a separator, and common items (palette, help)

#### Scenario: Goal orchestrator context menu
- **GIVEN** the active pane has `@orc_id` matching `goal:*`
- **WHEN** the user opens the context menu
- **THEN** the menu shows navigation items, a separator, orchestration items prefixed with `▸` (check engineers, dispatch beads), a separator, complete goal prefixed with `⚠`, a separator, and common items

#### Scenario: Fallback for unrecognized panes
- **GIVEN** the active pane has no `@orc_id` set
- **WHEN** the user opens the context menu
- **THEN** the menu shows only command palette and help items

### Requirement: Pre-Send Validation for Orchestration Actions

Before sending any slash command to an agent pane, the menu action callback SHALL run a validation sequence:

1. Re-resolve the target pane by `@orc_id` (not cached pane index)
2. If the pane is not found, abort with a tmux `display-message` notification and take no action
3. Check `#{pane_in_mode}` — if the pane is in copy mode, abort with `display-message "Exit copy mode first"`
4. Read the pane's `.worker-status` file — verify the agent is in a state where the command is meaningful
5. Send the slash command via `_tmux_send_pane` (load-buffer + paste-buffer pattern), NOT raw `send-keys`

The validation logic SHALL live in a dedicated `_tmux_safe_to_send()` helper in `_common.sh` reusable by other subsystems.

#### Scenario: Pane disappeared between menu open and action
- **GIVEN** the user opened the context menu for engineer pane `eng: bd-a1b2`
- **AND** the pane was destroyed (teardown) before the user selected an action
- **WHEN** the user selects "Mark done"
- **THEN** the callback re-resolves by `@orc_id`, finds no match, and shows `display-message "Pane not found — no action taken"`
- **AND** no input is sent to any pane

#### Scenario: Pane in copy mode
- **GIVEN** the target engineer pane is in tmux copy mode
- **WHEN** the user selects "Signal blocked" from the context menu
- **THEN** the callback detects copy mode and shows `display-message "Exit copy mode first"`
- **AND** no input is sent to the pane

#### Scenario: Successful orchestration action
- **GIVEN** the target engineer pane exists, is not in copy mode, and has status `working`
- **WHEN** the user selects "Mark done"
- **THEN** the callback sends `/orc:done` to the pane via `_tmux_send_pane`
- **AND** the agent in that pane receives and processes the slash command

### Requirement: Confirmed Actions

Actions classified as destructive SHALL use tmux `confirm-before` to require explicit user confirmation before execution.

In v1, the only confirmed action is "Complete goal" on goal orchestrator panes. This sends `/orc:complete-goal` which triggers the delivery pipeline.

The `confirm-before` prompt SHALL include the action name and target for clarity.

#### Scenario: Complete goal requires confirmation
- **GIVEN** the user opens the context menu on a goal orchestrator pane for goal `fix-auth`
- **WHEN** the user selects "⚠ Complete goal"
- **THEN** tmux shows a status-line prompt: `Complete goal fix-auth? This triggers delivery. (y/n)`
- **AND** only pressing `y` proceeds with the action
- **AND** pressing any other key cancels with no action

### Requirement: No Halt or Teardown in Menu

The v1 context menu SHALL NOT include halt (send C-c), teardown, kill-pane, or any action that destroys agent sessions or removes worktrees.

These operations SHALL remain available only via the `orc` CLI (`orc halt`, `orc teardown`) where the user explicitly types the command.

#### Scenario: No destructive shortcut
- **WHEN** the user opens any context menu in any role
- **THEN** no menu item for halt, teardown, kill, or stop is present

### Requirement: Navigate Submenu

The "Command palette" menu item SHALL open the command palette (if fzf is available) or a submenu listing all orc windows (if fzf is not available).

When fzf is not available, the submenu SHALL list windows using `tmux display-menu` with one entry per orc window, annotated with `@orc_status`.

#### Scenario: Navigate via palette
- **GIVEN** fzf is installed
- **WHEN** the user selects "Command palette" from any context menu
- **THEN** the command palette opens (same as `Prefix + Space`)

#### Scenario: Navigate via submenu
- **GIVEN** fzf is not installed
- **WHEN** the user selects "Command palette" from any context menu
- **THEN** a submenu appears listing all orc windows with role annotations
- **AND** selecting a window switches focus to it

