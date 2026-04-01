# tui-window-chooser Specification

## Purpose
TBD - created by archiving change add-window-chooser-popup. Update Purpose after archive.
## Requirements
### Requirement: Compact Tab Display Names

The system SHALL render abbreviated display names in tmux window tabs instead of full window names when `tui.enabled` is `true`.

Each window SHALL have a short display name stored as the `@orc_short` tmux user option, set at window creation time.

Short name derivation rules:
- `orc` → `root` (existing behavior, preserved)
- `status` → `status`
- `{project}/board` → `board`
- `{project}` (project orchestrator) → project key verbatim
- `{project}/{goal}` (goal window) → extracted ticket prefix if present (e.g., `WEN-949`), otherwise truncated to 12 characters with ellipsis
- `{project}/{goal}:N` (overflow) → short name + `:N` suffix

Ticket prefix extraction SHALL match the pattern `[A-Z]+-[0-9]+` at the start of the goal segment (after the `/` separator).

The `window-status-format` and `window-status-current-format` SHALL render `#{@orc_short}` when set, falling back to `#W` when unset.

#### Scenario: Goal window with Jira ticket prefix
- **GIVEN** a goal window named `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness`
- **WHEN** the window is created
- **THEN** `@orc_short` is set to `WEN-949`
- **AND** the tab renders as ` WEN-949 ● ` (with status indicator)

#### Scenario: Goal window without ticket prefix
- **GIVEN** a goal window named `myapp/fix-auth-timeout-bug`
- **WHEN** the window is created
- **THEN** `@orc_short` is set to `fix-auth-ti…` (truncated to 12 characters)
- **AND** the tab renders with the truncated name

#### Scenario: Overflow window
- **GIVEN** a goal window `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness:2`
- **WHEN** the window is created
- **THEN** `@orc_short` is set to `WEN-949:2`

#### Scenario: Project orchestrator tab
- **GIVEN** a project orchestrator window named `wrkbelt`
- **WHEN** the window is created
- **THEN** `@orc_short` is set to `wrkbelt` (unchanged, already short)

#### Scenario: Backwards compatibility when @orc_short is unset
- **GIVEN** a window created before this feature (no `@orc_short` option)
- **WHEN** the tab is rendered
- **THEN** the format falls back to `#W` (full window name)
- **AND** no error or blank tab occurs

### Requirement: Window Chooser Popup Trigger

The system SHALL bind `Prefix + w` to launch the window chooser popup in the orc tmux session when `tui.enabled` is `true`.

When `keybindings.enabled` is `true`, the system SHALL also bind the key configured at `keybindings.chooser` (default `M-w`) to launch the chooser.

The chooser SHALL open as a tmux popup (via `fzf-tmux --popup`) centered in the terminal.

When the user selects an entry and presses Enter, focus SHALL move to the selected window or pane. No input SHALL be sent to any agent pane.

When the user presses Escape or Ctrl+C, the popup SHALL close with no action.

#### Scenario: Open chooser via prefix key
- **WHEN** the user presses `Prefix + w` in any orc tmux pane
- **THEN** a popup appears showing the hierarchical window tree
- **AND** the popup accepts keyboard input for fuzzy filtering

#### Scenario: Select and navigate
- **GIVEN** the window chooser is open
- **WHEN** the user selects a goal window entry and presses Enter
- **THEN** the popup closes and focus moves to that goal window's pane 0
- **AND** no input is sent to any agent pane

#### Scenario: Select a specific pane
- **GIVEN** the window chooser is open showing panes under a goal window
- **WHEN** the user selects an engineer pane entry and presses Enter
- **THEN** the popup closes, focus moves to that goal window, and the engineer pane is selected

#### Scenario: Cancel chooser
- **WHEN** the user presses Escape or Ctrl+C in the chooser
- **THEN** the popup closes with no action
- **AND** focus returns to the previously active pane

#### Scenario: Alt keybinding
- **GIVEN** `keybindings.enabled = true` and `keybindings.chooser = "M-w"`
- **WHEN** the user presses `Alt + w`
- **THEN** the window chooser opens (same behavior as `Prefix + w`)

### Requirement: Hierarchical Tree View

The window chooser SHALL display entries in a tree structure grouped by project.

The tree SHALL show the following hierarchy:
1. **System windows** (root orchestrator, status dashboard) — at the top, ungrouped
2. **Project groups** — one section per registered project with active windows
3. **Goal windows** — nested under their project, with status indicators
4. **Panes** — nested under their goal window (engineers, reviewers), with status indicators

Each entry SHALL display:
- Role icon (`⚔` orchestrator, `◆` dashboard/board, `●` engineer, `✓` reviewer)
- Display name (short name for windows, bead ID or title for panes)
- Status indicator from `@orc_status` or `.worker-status`

Tree indentation SHALL use visual connectors (`├─`, `└─`, `│`) for structure.

The tree order SHALL be preserved during fuzzy search (entries maintain their hierarchical position, non-matches are hidden).

#### Scenario: Multi-project tree
- **GIVEN** projects `wrkbelt` (2 goals, 3 engineers) and `obsidian-ai` (idle)
- **WHEN** the user opens the window chooser
- **THEN** the tree shows:
  - System: root, status
  - wrkbelt group: project orch, goal 1 with engineers, goal 2 with engineers
  - obsidian-ai group: project orch only (no goals)
- **AND** each entry shows its current status indicator

#### Scenario: Idle project
- **GIVEN** a registered project `calctest` with no active goals or workers
- **AND** no project orchestrator window exists for `calctest`
- **WHEN** the user opens the window chooser
- **THEN** `calctest` does NOT appear in the tree (no window to navigate to)

#### Scenario: Goal with dead orchestrator
- **GIVEN** a goal window where the goal orchestrator pane has exited
- **WHEN** the user opens the window chooser
- **THEN** the goal entry shows `✗ dead` status
- **AND** the entry is still selectable for navigation

### Requirement: Graceful Degradation

When fzf is not installed, the window chooser SHALL fall back to tmux's native `choose-tree` command with orc-aware formatting.

The fallback SHALL filter to the orc session and display `@orc_id` and `@orc_status` where available.

#### Scenario: fzf not installed
- **GIVEN** fzf is not in `$PATH`
- **WHEN** the user triggers the window chooser
- **THEN** tmux's `choose-tree` opens with orc-formatted entries
- **AND** basic navigation (arrow keys, Enter) works without fzf

