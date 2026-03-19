## ADDED Requirements

### Requirement: Status Dashboard
`orc status` SHALL display a formatted dashboard showing all projects, their active workers with bead IDs, titles, statuses (● working, ✓ review, ✗ blocked, ✗ dead), elapsed time, blocked reasons inline, queued beads, and a header summary with total counts and "needs attention" callout.

#### Scenario: Full dashboard output
- **WHEN** `orc status` is run with active workers across multiple projects
- **THEN** each project section shows worker bead IDs, titles, status indicators, elapsed time, and any blocked reasons

#### Scenario: Dead sessions flagged
- **WHEN** a worktree exists but the agent has exited
- **THEN** `orc status` shows the worktree as `✗ dead (agent exited)` with a "needs attention" callout

#### Scenario: Idle project shown
- **WHEN** a registered project has no active workers
- **THEN** `orc status` shows the project with `(idle — no active workers)`

### Requirement: Status Bar Integration
`orc status` internals (specifically `_orc_status_line`) SHALL be reusable as the tmux `status-right` format to power the ambient status bar display.

#### Scenario: Status bar uses same data source
- **WHEN** the tmux status bar refreshes
- **THEN** the aggregate health counts shown match what `orc status` would report

### Requirement: Board View
`orc board <project>` SHALL open a board view in a tmux window named `<project>/board`. If a board command is configured and available on PATH, it is used. Otherwise, the built-in fallback `watch -n5 bd list` is used.

#### Scenario: Configured board tool used
- **WHEN** `board.command = "abacus"` is configured and `abacus` is on PATH
- **THEN** `orc board myapp` launches abacus in the myapp/board window

#### Scenario: Built-in fallback when no tool configured
- **WHEN** `board.command` is empty
- **THEN** `orc board myapp` launches `watch -n5 bd list` in the myapp/board window

### Requirement: Leave Command
`orc leave` SHALL detach the user from the orc tmux session when inside tmux, or show a message with re-entry instructions when outside tmux. `/orc:leave` slash command SHALL instruct the agent to report state and then run `tmux detach-client`.

#### Scenario: Leave from inside tmux
- **WHEN** `orc leave` is run from inside the orc tmux session
- **THEN** active windows are listed, a message confirms background operation, and the client is detached

#### Scenario: Leave from outside tmux
- **WHEN** `orc leave` is run from outside tmux
- **THEN** a message indicates the user is not attached and shows how to re-attach
