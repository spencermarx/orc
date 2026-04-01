# tui-command-palette Specification

## Purpose
TBD - created by archiving change add-tui-navigation-layer. Update Purpose after archive.
## Requirements
### Requirement: Palette Configuration

The system SHALL support a `[tui.palette]` config section with the following fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Toggle palette entirely (when `[tui] enabled` is also `true`) |
| `show_preview` | boolean | `true` | Show live pane content preview when browsing palette |

Popup dimensions SHALL be calculated responsively based on the terminal size, not user-configured.

When `tui.palette.enabled` is `false`, the `Prefix + Space` binding SHALL NOT be registered.

When `[tui] enabled` is `false`, no palette binding SHALL be registered regardless of `tui.palette.enabled`.

#### Scenario: Palette disabled via config
- **GIVEN** the user sets `tui.palette.enabled = false`
- **WHEN** the orc tmux session initializes
- **THEN** no `Prefix + Space` binding is registered
- **AND** the palette is not available

#### Scenario: Responsive popup sizing
- **GIVEN** the terminal window is resized to various dimensions
- **WHEN** the user opens the command palette
- **THEN** the fzf popup adapts its dimensions to fit the available terminal space

### Requirement: Palette Trigger

The system SHALL bind `Prefix + Space` to launch the command palette in the orc tmux session (when enabled).

The palette SHALL open as a tmux popup (via `fzf-tmux --popup`) centered in the terminal.

#### Scenario: User opens command palette
- **WHEN** the user presses `Prefix + Space` in any orc tmux pane
- **THEN** a popup appears listing all navigable targets and quick actions
- **AND** the popup accepts keyboard input for fuzzy filtering

#### Scenario: Palette closes on selection
- **WHEN** the user selects a navigation entry and presses Enter
- **THEN** the palette closes and focus moves to the selected window/pane
- **AND** no input is sent to any agent pane

#### Scenario: Palette closes on escape
- **WHEN** the user presses Escape or Ctrl+C
- **THEN** the palette closes with no action
- **AND** focus returns to the previously active pane

### Requirement: Navigation Entries

The palette SHALL list all orc-managed windows and panes as navigation entries.

Each navigation entry SHALL display: role icon (`⚔` for orchestrators, `●` for engineers, `✓` for reviewers), role label (e.g., `[project-orch]`, `[goal-orch]`, `[engineer]`, `[reviewer]`), target name (window/pane path), worker state indicator, and elapsed time.

Entries SHALL be grouped with navigation entries first, then quick action entries, separated by a visual divider.

#### Scenario: Palette shows all active workers
- **GIVEN** a session with project `myapp`, goal `fix-auth` with 2 engineers and 1 reviewer
- **WHEN** the user opens the command palette
- **THEN** the palette lists at minimum: the project orchestrator, goal orchestrator, both engineer entries with bead IDs, and the reviewer entry
- **AND** each entry shows its current worker state and elapsed time

#### Scenario: Fuzzy search filters entries
- **WHEN** the user types `auth` in the palette
- **THEN** only entries matching `auth` are shown (e.g., `myapp/fix-auth` and its child panes)
- **AND** the filter is case-insensitive and matches anywhere in the entry text

### Requirement: Quick Action Entries

The palette SHALL include non-destructive quick actions as entries.

Quick actions SHALL be limited to navigation-equivalent operations: jump to status dashboard, jump to board view, and open help overlay.

The palette SHALL NOT include any action that sends input to agent panes, kills processes, or modifies session state beyond focus changes.

#### Scenario: User jumps to status via palette
- **WHEN** the user selects the "Status dashboard" quick action
- **THEN** the palette closes and focus switches to the status window

#### Scenario: No destructive actions in palette
- **WHEN** the user opens the command palette
- **THEN** no entries for halt, teardown, dispatch, check, done, blocked, or other agent-interacting commands are listed

### Requirement: Pane Preview

When `show_preview` is `true` (default) and fzf is available, the palette SHALL show a live preview of the highlighted pane's recent output in a side panel.

The preview SHALL display the last ~20 lines of the pane's content via `tmux capture-pane -p -S -20`.

The preview SHALL be read-only and ephemeral — it does not affect the target pane.

#### Scenario: Preview shows pane content
- **GIVEN** preview is enabled and the user highlights an engineer entry in the palette
- **WHEN** the entry is highlighted (not yet selected)
- **THEN** the right side of the popup shows the last ~20 lines of that engineer pane's terminal output

#### Scenario: Preview unavailable
- **GIVEN** the highlighted entry refers to a pane that no longer exists
- **WHEN** the user highlights that entry
- **THEN** the preview panel shows "Preview unavailable" instead of an error

### Requirement: Graceful Degradation Without fzf

When fzf is not installed, the `Prefix + Space` binding SHALL fall back to tmux `choose-tree` with a custom format string that includes orc role annotations from `@orc_id` and `@orc_status`.

The system SHALL NOT error or show a broken UI when fzf is absent.

#### Scenario: Palette without fzf
- **GIVEN** fzf is not installed on the system
- **WHEN** the user presses `Prefix + Space`
- **THEN** tmux `choose-tree` opens with formatted entries showing orc role context
- **AND** the user can navigate and select windows/panes using tmux's built-in tree UI

#### Scenario: Doctor reports fzf status
- **WHEN** the user runs `orc doctor`
- **THEN** the output includes a non-blocking recommendation for fzf if it is not installed
- **AND** it does NOT report fzf absence as an error

