# Change: Add Hierarchical Multi-Pane TUI Layout

## Why

Today every agent — project orchestrator, goal orchestrator, engineer —
gets its own tmux **window** (tab). The tab bar becomes a flat list
(`orc | status | myapp | myapp/fix-auth | myapp/fix-auth/bd-a1b2 | …`)
that loses the hierarchy: you cannot see at a glance that `bd-a1b2`
belongs to goal `fix-auth` which belongs to project `myapp`.

The user's mental model is hierarchical: a project contains goals, a
goal contains engineers. The TUI should mirror that with panes inside
windows, not proliferating windows.

## What Changes

- **Goal orchestrators spawn as panes** inside the project window
  (right column, `main-vertical` layout). The project orchestrator
  keeps the main pane (left, ~60%). Multiple goals stack in the right
  column.

- **Engineers spawn as panes** inside their goal window (right column,
  `main-vertical`). The goal orchestrator keeps the main pane. Multiple
  engineers stack in the right column.

- **Overflow windows** are created automatically when adding a pane
  would violate minimum-size constraints. Overflow windows are named
  `<base>:2`, `<base>:3`, etc. and share the same `main-vertical`
  layout. Worker capacity (`max_workers`) is never artificially limited
  for layout reasons.

- **Teardown is pane-aware.** Tearing down a bead kills its pane and
  rebalances siblings. Tearing down a goal kills the goal pane from the
  project window plus all associated goal/overflow windows.

- **Review panes** split the engineer's pane slot within the goal
  window (or overflow window).

## Impact

- Affected specs: tmux-layout (new), pane-overflow (new)
- Affected code:
  - `packages/cli/lib/_common.sh` — new overflow helper, split-with-agent helper
  - `packages/cli/lib/spawn-goal.sh` — split project window instead of creating new window
  - `packages/cli/lib/spawn.sh` — split goal window instead of creating new window
  - `packages/cli/lib/teardown.sh` — pane-aware teardown with rebalancing
  - `packages/cli/lib/review.sh` — review within goal window context
  - `packages/commands/claude/orc/view.md` — updated layout docs
  - `packages/commands/claude/orc/dispatch.md` — pane-based references
  - `CLAUDE.md` — tmux layout section update
