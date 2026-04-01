# tui-status-enhancements Specification

## Purpose

Enhance the tmux status bar and window tabs with contextual navigation cues: breadcrumbs showing hierarchical position, prefix mode indicator, enriched window tabs, and a discoverable help hint. Breadcrumbs and help hint are individually toggleable; prefix indicator and enriched tabs are always on when TUI is enabled (purely additive, no reason to disable).

## ADDED Requirements

### Requirement: TUI Master Toggle

The system SHALL support a `[tui]` config section with a master `enabled` field (boolean, default `true`).

When `tui.enabled` is `false`, ALL TUI navigation layer features SHALL be disabled: no palette bindings, no context menu bindings, no keybindings, no breadcrumbs, no prefix indicator, no help hint, no enriched tabs. The status bar reverts to its pre-navigation-layer appearance.

This provides a single switch for users who want raw tmux with no orc UI enhancements.

#### Scenario: TUI disabled
- **GIVEN** the user sets `tui.enabled = false`
- **WHEN** the orc tmux session initializes
- **THEN** no TUI navigation layer features are active
- **AND** the status bar renders as it did before this change

#### Scenario: TUI enabled (default)
- **GIVEN** a fresh orc installation with default config
- **WHEN** the orc tmux session initializes
- **THEN** all TUI features with `true` defaults are active

### Requirement: Status Enhancement Configuration

The system SHALL support the following fields in the `[tui]` config section:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Master toggle for all TUI enhancements |
| `breadcrumbs` | boolean | `true` | Context-aware breadcrumb in status-left |
| `show_help_hint` | boolean | `true` | Subtle help hint in status-right for new users |

Prefix mode indicator and enriched window tabs are always active when `tui.enabled` is `true` — they are purely additive visual enhancements with no user-facing reason to disable individually.

#### Scenario: Breadcrumbs only
- **GIVEN** the user sets `tui.breadcrumbs = true` and `tui.show_help_hint = false`
- **WHEN** the status bar renders
- **THEN** the breadcrumb trail appears in status-left
- **AND** no help hint is shown in status-right
- **AND** prefix indicator and enriched tabs are still active (always on)

### Requirement: Breadcrumb Status Left

When `tui.breadcrumbs` is `true`, the tmux status-left SHALL display a context-aware breadcrumb trail reflecting the active window's position in the orc hierarchy.

The breadcrumb SHALL derive context from the active window name (which follows `project/goal` naming) and active pane title.

Format: `⚔ orc ▸ {project} ▸ {goal} ▸ {bead}` — segments omitted when not applicable.

- Root orchestrator window (`orc`): `⚔ orc ▸`
- Status window (`status`): `⚔ orc ▸ status`
- Project orchestrator window (`myapp`): `⚔ orc ▸ myapp ▸`
- Goal window with goal orch focused: `⚔ orc ▸ myapp ▸ fix-auth ▸`
- Goal window with engineer focused: `⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2`

The breadcrumb SHALL truncate from the left when it exceeds `status-left-length`, preserving the rightmost (most specific) segments with a `…` prefix.

When `tui.breadcrumbs` is `false`, the status-left SHALL render the original static `⚔ orc ▸`.

#### Scenario: Breadcrumb updates on window switch
- **GIVEN** the user is on window `myapp/fix-auth` with an engineer pane focused
- **WHEN** the user switches to window `myapp`
- **THEN** the status-left updates from `⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2` to `⚔ orc ▸ myapp ▸`

#### Scenario: Breadcrumb updates on pane focus
- **GIVEN** the user is on window `myapp/fix-auth` with the goal orchestrator pane focused
- **WHEN** the user switches focus to an engineer pane titled `eng: bd-a1b2`
- **THEN** the status-left updates to include `▸ bd-a1b2`

#### Scenario: Breadcrumb truncation
- **GIVEN** the breadcrumb would be `⚔ orc ▸ my-long-project ▸ fix-authentication-bug ▸ bd-a1b2c3d4`
- **AND** this exceeds the configured `status-left-length`
- **THEN** the leftmost segments are truncated: `…fix-authentication-bug ▸ bd-a1b2c3d4`

#### Scenario: Breadcrumbs disabled
- **GIVEN** `tui.breadcrumbs = false`
- **WHEN** the status bar renders
- **THEN** the status-left shows the original static `⚔ orc ▸`

### Requirement: Prefix Mode Indicator

When `tui.enabled` is `true`, the `⚔ orc` segment in status-left SHALL visually change when the tmux prefix key is active.

The indicator SHALL use tmux's `#{client_prefix}` format conditional to switch styling:
- **Normal:** accent background, dark foreground (existing appearance)
- **Prefix active:** reversed/highlighted appearance (e.g., white background, dark foreground, bold uppercase `ORC`)

This provides instant visual confirmation that the prefix key was registered. The prefix indicator is always on when TUI is enabled — it has no individual toggle.

#### Scenario: Prefix indicator activates
- **GIVEN** `tui.enabled = true`
- **WHEN** the user presses the tmux prefix key (e.g., `Ctrl+b`)
- **THEN** the `⚔ orc` segment visually changes (e.g., reversed colors, uppercase)
- **AND** when the prefix times out or an action completes, the segment returns to normal

#### Scenario: Prefix indicator off when TUI disabled
- **GIVEN** `tui.enabled = false`
- **WHEN** the user presses the tmux prefix key
- **THEN** the `⚔ orc` segment appearance does not change (pre-navigation-layer behavior)

### Requirement: Enriched Window Tabs

When `tui.enabled` is `true`, goal window tabs in the status bar SHALL display the count of engineer panes.

Format for goal windows: `{goal-name} {N}▸ {status-icon}` where `{N}` is the number of non-orchestrator, non-reviewer panes (i.e., engineer panes).

Non-goal windows (root, status, project, board) SHALL retain their existing format.

Enriched tabs are always on when TUI is enabled — they have no individual toggle.

#### Scenario: Goal window tab shows engineer count
- **GIVEN** `tui.enabled = true` and window `myapp/fix-auth` has 1 goal orchestrator pane and 3 engineer panes
- **WHEN** the user views the status bar
- **THEN** the tab for that window shows `fix-auth 3▸ ●`

#### Scenario: Engineer count updates on spawn/teardown
- **GIVEN** window `myapp/fix-auth` shows `fix-auth 2▸ ●`
- **WHEN** a new engineer is spawned in that window
- **THEN** the tab updates to `fix-auth 3▸ ●` within the next status bar refresh interval (default 10 seconds)

#### Scenario: Enriched tabs off when TUI disabled
- **GIVEN** `tui.enabled = false`
- **WHEN** the status bar renders
- **THEN** goal window tabs use the existing format without engineer count (pre-navigation-layer behavior)

### Requirement: Help Hint in Status Right

When `tui.show_help_hint` is `true`, the status-right SHALL include a subtle help hint using the `muted` theme color.

The hint text SHALL adapt based on keybinding state:
- Keybindings enabled: `Alt+? help`
- Keybindings disabled: `^b ? help`

The hint SHALL appear at the end of the status-right, after the version indicator.

When `tui.show_help_hint` is `false`, no hint appears.

#### Scenario: Help hint shown
- **GIVEN** `tui.show_help_hint = true` and `keybindings.enabled = false`
- **WHEN** the user views the status bar
- **THEN** the rightmost element shows `^b ? help` in muted color

#### Scenario: Help hint with keybindings
- **GIVEN** `tui.show_help_hint = true` and `keybindings.enabled = true`
- **WHEN** the user views the status bar
- **THEN** the rightmost element shows `Alt+? help` in muted color

#### Scenario: Help hint disabled
- **GIVEN** `tui.show_help_hint = false`
- **WHEN** the user views the status bar
- **THEN** no help hint appears in the status-right

### Requirement: Status Left Length Adjustment

The `status-left-length` SHALL be increased from 20 to 60 to accommodate breadcrumb content when breadcrumbs are enabled.

When breadcrumbs are disabled, the `status-left-length` SHALL remain at the original value of 20.

The breadcrumb rendering SHALL be called via `#()` shell expansion in `status-left`, matching the existing pattern used for `status-right`.

#### Scenario: Long breadcrumb fits
- **GIVEN** breadcrumbs are enabled and the breadcrumb is `⚔ orc ▸ myapp ▸ fix-auth ▸` (31 characters)
- **WHEN** the status bar renders
- **THEN** the full breadcrumb is visible without truncation

#### Scenario: Original length when breadcrumbs disabled
- **GIVEN** `tui.breadcrumbs = false`
- **WHEN** the session initializes
- **THEN** `status-left-length` is set to 20 (original value)
