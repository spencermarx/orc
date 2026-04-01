# tui-keybinding-layer Specification

## Purpose
TBD - created by archiving change add-tui-navigation-layer. Update Purpose after archive.
## Requirements
### Requirement: Keybinding Configuration

The system SHALL support a `[keybindings]` config section with the following fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Master toggle for prefix-free Alt+ keybindings |
| `project` | string | `"M-0"` | Jump to project orchestrator |
| `dashboard` | string | `"M-s"` | Jump to status dashboard |
| `prev` | string | `"M-["` | Previous window |
| `next` | string | `"M-]"` | Next window |
| `palette` | string | `"M-p"` | Open command palette |
| `menu` | string | `"M-m"` | Open context menu |
| `help` | string | `"M-?"` | Toggle help overlay |

Field names map to orc's hierarchy (`project`, `dashboard`) rather than generic tmux concepts, making them self-documenting in `config.toml`.

When `enabled` is `false`, no orc-specific keybindings SHALL be registered beyond `Prefix + Space` (palette), `Prefix + m` (context menu), and `Prefix + ?` (help), which are controlled by their respective feature toggles.

Setting any key field to `""` (empty string) SHALL disable that specific binding without affecting others.

Keys SHALL use tmux key notation (e.g., `M-` for Alt/Option, `C-` for Ctrl).

#### Scenario: Keybindings disabled by default
- **GIVEN** a fresh orc installation with default config
- **WHEN** the user starts an orc session
- **THEN** only `Prefix + Space`, `Prefix + m`, and `Prefix + ?` are bound (controlled by their own toggles)
- **AND** no `Alt+` keybindings are registered

#### Scenario: Keybindings enabled
- **GIVEN** the user sets `keybindings.enabled = true` in config
- **WHEN** the user starts an orc session
- **THEN** all non-empty `Alt+` keybindings are registered in the orc tmux session
- **AND** existing tmux prefix keybindings remain unchanged

#### Scenario: Individual key override
- **GIVEN** the user sets `keybindings.prev = "M-h"` and `keybindings.next = "M-l"`
- **WHEN** the orc session initializes
- **THEN** `Alt+h` switches to previous window and `Alt+l` switches to next window
- **AND** the default `Alt+[` and `Alt+]` bindings are NOT registered

#### Scenario: Individual key disabled
- **GIVEN** the user sets `keybindings.project = ""`
- **WHEN** the orc session initializes
- **THEN** no binding is registered for the "project" action
- **AND** all other keybindings are registered normally

### Requirement: Navigation Keybindings

When keybindings are enabled, the system SHALL bind the configured keys to these actions:

| Default Key | Config Key | Action | Description |
|-------------|-----------|--------|-------------|
| `Alt+[` | `prev` | Previous window | `tmux select-window -t :-` |
| `Alt+]` | `next` | Next window | `tmux select-window -t :+` |
| `Alt+0` | `project` | Jump to project orchestrator | `tmux select-window -t orc:{project}` |
| `Alt+s` | `dashboard` | Jump to status dashboard | `tmux select-window -t orc:status` |
| `Alt+p` | `palette` | Open command palette | Invokes `palette.sh` |
| `Alt+m` | `menu` | Open context menu | Invokes `menu.sh` |
| `Alt+?` | `help` | Toggle help overlay | Invokes `help.sh` via `display-popup` |

All bindings SHALL use tmux `bind -n` (root table — no prefix required).

All keybinding actions SHALL be navigation-only (focus changes, read-only popups). No keybinding SHALL send input to agent panes or perform destructive operations.

#### Scenario: Quick window cycling
- **GIVEN** keybindings are enabled and the user is on window `myapp/fix-auth`
- **WHEN** the user presses `Alt+]`
- **THEN** focus moves to the next window in the session
- **AND** no tmux prefix key is required

#### Scenario: Jump to project orchestrator
- **GIVEN** keybindings are enabled and project `myapp` is registered
- **WHEN** the user presses `Alt+0`
- **THEN** focus jumps to the `myapp` project orchestrator window

#### Scenario: Jump to status
- **WHEN** the user presses `Alt+s`
- **THEN** focus jumps to the `status` window

### Requirement: Help Overlay

The system SHALL provide a help overlay triggered by the configured help key (default `Alt+?`) when keybindings are enabled, AND by `Prefix + ?` always (regardless of keybinding config, when `[tui] enabled` is `true`).

The overlay SHALL render in a tmux `display-popup` centered in the terminal.

The overlay content SHALL be dynamically generated from the active keybinding configuration, reflecting any user overrides or disabled keys.

The overlay SHALL close when the user presses `q`, `Escape`, or any other key.

#### Scenario: Help overlay with default bindings
- **WHEN** the user presses `Alt+?` (or `Prefix + ?`)
- **THEN** a centered popup appears listing all orc keybindings with their current key assignments and descriptions
- **AND** pressing `q` or `Escape` closes the popup

#### Scenario: Help overlay reflects overrides
- **GIVEN** the user has overridden `keybindings.prev = "M-h"`
- **WHEN** the user opens the help overlay
- **THEN** the entry for "Previous window" shows `Alt+h` instead of `Alt+[`

#### Scenario: Help from prefix when keybindings disabled
- **GIVEN** `keybindings.enabled = false` and `tui.enabled = true`
- **WHEN** the user presses `Prefix + ?`
- **THEN** the help overlay appears showing available prefix-based bindings (palette, context menu, help)
- **AND** the Alt+ bindings section indicates they are disabled with instructions to enable

### Requirement: Doctor Validates Keybindings

`orc doctor` SHALL validate the `[keybindings]` config section.

All key fields SHALL be validated as valid tmux key notation or empty string.

When keybindings are enabled, doctor SHALL check for known terminal emulator conflicts and emit a warning with remediation steps.

#### Scenario: Doctor warns about Alt key conflicts
- **GIVEN** keybindings are enabled
- **AND** the terminal is detected as iTerm2
- **WHEN** the user runs `orc doctor`
- **THEN** doctor emits a non-blocking warning: "iTerm2 requires 'Option key sends +Esc' for Alt keybindings. Check Preferences > Profiles > Keys."

#### Scenario: Invalid key notation
- **GIVEN** the user sets `keybindings.dashboard = "invalid-key"`
- **WHEN** the user runs `orc doctor`
- **THEN** doctor reports a validation error for the invalid key notation

