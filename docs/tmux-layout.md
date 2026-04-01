# tmux Layout & Navigation

Orc runs every agent — orchestrators, engineers, reviewers — inside a single tmux session. This gives you one place to observe, navigate, and manage all active work across every project.

## Session Structure

All windows live in a session named `orc`. Each project gets a window, each goal gets a window, and special-purpose windows (dashboard, board) sit alongside them:

```
Session: orc
├── orc                          <- Root orchestrator
├── status                       <- Live dashboard
├── myapp                        <- Project orchestrator
├── myapp/fix-auth               <- Goal window
├── myapp/add-rate-limit         <- Goal window
├── myapp/board                  <- Board view
└── api                          <- Another project orchestrator
```

Window names are stable identifiers. Orc never renames them during a session, so tmux keybindings and scripts can target them reliably.

### Compact Tab Names

Goal window tabs render abbreviated names to prevent the tab strip from overflowing. Jira-style ticket prefixes are extracted automatically:

| Window Name | Tab Display |
|---|---|
| `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness` | `WEN-949` |
| `myapp/fix-auth-timeout-bug` | `fix-auth-ti…` |
| `myapp/fix-auth-timeout-bug:2` | `fix-auth-ti…:2` |
| `wrkbelt` | `wrkbelt` |
| `orc` | `root` |

Short names are stored as `@orc_short` tmux user options (per-window, set at creation, backfilled for existing windows on theme apply). The tab format falls back to the full window name when `@orc_short` is unset.

## Inside a Goal Window

Each goal window uses a `main-vertical` layout. The goal orchestrator occupies the left pane (persistent, roughly 60% width). Engineers stack on the right, each in its own pane.

Each goal window's working directory is the goal orchestrator's worktree (`{project}/.worktrees/goal-<name>`), not the project root.

```
+------------------------------+------------------+
|                              |  eng: bd-a1b2    |
|                              |  (being reviewed) |
|   goal: fix-auth             +------------------+
|   (Goal Orchestrator)        |  > rev: bd-a1b2  |
|                              |  (ephemeral)     |
|   pane 0 -- persistent,     +------------------+
|   manages the review loop    |  eng: bd-c3d4    |
|                              |  (working)       |
+------------------------------+------------------+
```

Each reviewer spawns directly below its engineer pane, forming a clear visual pair. When the review round ends (approved or feedback delivered), the reviewer pane is destroyed and the engineer reclaims the vertical space.

### Pane Identification

Panes are identified by `@orc_id` — a stable tmux user option that persists even when agent CLIs overwrite pane titles. The format is:

- `goal: <name> (<branch>)` — goal orchestrator (pane 0)
- `eng: <bead>` or `eng: <bead> — <title>` — engineer
- `review: <project>/<bead> R<round>` — reviewer (ephemeral)

To list panes with their IDs:

```bash
tmux list-panes -t orc:myapp/fix-auth -F '#{pane_index}:#{pane_title}'
# For stable identification:
for idx in $(tmux list-panes -t orc:myapp/fix-auth -F '#{pane_index}'); do
  echo "$idx: $(tmux show-option -t "orc:myapp/fix-auth.$idx" -p -v @orc_id 2>/dev/null)"
done
```

### Pane Management

All pane operations go through orc CLI commands — never create, split, or manage tmux panes directly:

| Action | Command |
|--------|---------|
| Spawn an engineer | `orc spawn <project> <bead> <goal>` |
| Launch a review | `orc review <project> <bead>` |
| Tear down a bead | `orc teardown <project> <bead>` |
| Clean orphan panes | Automatic via `/orc:check` Step 0 |

Panes created outside orc don't get `@orc_id` set, aren't tracked for cleanup, and break the main-vertical layout.

### Orphan Pane Cleanup

When `/orc:check` runs in a goal window, it first detects and removes **orphan panes** — panes without a recognized `@orc_id` (typically leftover sub-agent sessions or dead reviewers). Orphans are killed in reverse index order, then the main-vertical layout is re-applied.

The shell helper `_tmux_cleanup_goal_window` performs this cleanup and can be called directly when needed.

## Overflow Windows

Orc respects minimum pane dimensions. When a goal window cannot fit another pane — because doing so would push a pane below `min_pane_width` columns or `min_pane_height` rows — orc creates an overflow window with a `:N` suffix:

```
myapp/fix-auth      <- primary goal window
myapp/fix-auth:2    <- first overflow
myapp/fix-auth:3    <- second overflow
```

Overflow windows are managed automatically. Teardown cleans them up when the goal completes or is halted.

## Status Indicators

Window-level indicators appear in the tmux status bar via the `@orc_status` user option:

| Indicator | Meaning |
|-----------|---------|
| `●` | At least one engineer is actively coding |
| `✓` | A bead is waiting for or undergoing review |
| `✗` | An engineer has signaled blocked |

Indicators are rendered in `window-status-format`, not embedded in window names, so they update without disrupting tmux targeting.

Pane borders display titles set at spawn time. The goal orchestrator pane always shows the goal name; engineer panes show their bead ID.

### Status Bar

When TUI is enabled, the status bar shows:

- **Breadcrumb** (left): `⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2` — updates as you navigate
- **Prefix indicator**: `⚔ orc` flashes when prefix key is active
- **Health summary** (right): `2 ● working │ 1 ✓ review │ 3 goals │ ^b ? help`
- **Help hint**: `^b ? help` for new users (disable with `tui.show_help_hint = false`)

## Navigation

### TUI Navigation Layer

Orc provides a navigation overlay on top of tmux. All features are enabled by default when `tui.enabled = true`.

#### Window Chooser (`Prefix+w`)

Hierarchical tree view of all windows grouped by project, with live status indicators:

```
  ⚔ root
  ◆ status

  ⚔ myapp ●
    ◆ WEN-949 booking-flow-mobile  ● working
      └ ● wrkbelt-t5y
    ◆ WEN-950 auth-page-redesign   ✓ review
      └ ● wrkbelt-tgp
```

Arrow keys or type to fuzzy-search, Enter to navigate.

#### Command Palette (`Prefix+Space`)

Fuzzy-search any window or pane by name, role, or state. Requires `fzf` for full experience — falls back to tmux `choose-tree` without it.

- Shows all orchestrators, engineers, and reviewers with role icons and status
- Live pane preview (see what an agent is doing before switching)
- Quick actions: jump to dashboard, board, or help
- Navigation only — never sends input to agent panes

#### Context Menu (`Prefix+m` or right-click)

Role-aware action menu that adapts to the current pane:

- **Engineer pane:** Mark done, Signal blocked, Read feedback, navigate to goal/project orch
- **Goal orchestrator:** Check engineers, Dispatch beads, Complete goal (requires confirmation)
- **Project orchestrator:** Check workers, Dispatch ready work, navigate to status/board

Actions are grouped by safety tier:
- Unmarked = navigation (always safe)
- `▸` = orchestration (validated before sending)
- `!` = confirmed (requires y/n)

#### Help Overlay (`Prefix+?`)

Shows all available keybindings and commands. Always available when TUI is enabled.

### Keybindings (opt-in)

Set `keybindings.enabled = true` in config for prefix-free Alt+ shortcuts:

| Key | Action |
|-----|--------|
| `Alt+[` / `Alt+]` | Previous / Next window |
| `Alt+0` | Project orchestrator |
| `Alt+s` | Dashboard |
| `Alt+p` | Command palette |
| `Alt+w` | Window chooser |
| `Alt+m` | Context menu |
| `Alt+?` | Help overlay |

Every key is individually remappable in `[keybindings]` config. Set to `""` to disable.

### Standard Navigation

You can also use orc commands and standard tmux keybindings:

| Action | Command |
|--------|---------|
| Detach (agents keep running) | `orc leave` |
| Reattach to a project | `orc myapp` |
| Jump to an engineer worktree | `orc myapp bd-a1b2` |
| View the live dashboard | Switch to the `status` window (`Ctrl-b` + window index) |
| Check all project status | `orc status` (runs outside tmux too) |

Detaching with `orc leave` is safe — all agent sessions continue running in the background. Reattach at any time with `orc` (root) or `orc <project>` (specific project).

### Disabling

Set `tui.enabled = false` in `config.toml` to disable all TUI enhancements and revert to raw tmux.

## Configuration

Layout behavior is controlled in `config.toml` (or overridden in `config.local.toml`):

```toml
[layout]
min_pane_width = 40    # Minimum columns before creating overflow windows
min_pane_height = 10   # Minimum rows before creating overflow windows
```

Theme settings (status bar colors, indicator symbols, pane border styles) live in the `[theme]` config section. See [configuration](configuration.md) for the full reference.
