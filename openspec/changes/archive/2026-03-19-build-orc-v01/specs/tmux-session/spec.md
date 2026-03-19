## ADDED Requirements

### Requirement: Single Session Model
All orc agents, orchestrators, and views SHALL run in a single tmux session named `orc`.

#### Scenario: Session created on first use
- **WHEN** no `orc` tmux session exists and the user runs `orc`
- **THEN** a new tmux session named `orc` is created with branded styling

### Requirement: Session Focus
The CLI SHALL use `exec tmux attach-session` when entering from outside tmux (replacing the shell process) and `tmux switch-client` when navigating from inside tmux (any session).

#### Scenario: Focus from outside tmux
- **WHEN** the user runs `orc` from a terminal not inside tmux
- **THEN** the shell process is replaced with `tmux attach-session` via `exec`

#### Scenario: Focus from inside different tmux session
- **WHEN** the user runs `orc myproject` from inside a different tmux session
- **THEN** the client switches to the orc session via `tmux switch-client`

### Requirement: Status Bar as Instrument Panel
The tmux status bar SHALL display the orc brand on the left, the current window context, and aggregate engineer health on the right (counts of working, review, blocked states across all projects).

#### Scenario: Status bar shows aggregate health
- **WHEN** there are 3 engineers working, 1 in review, and 1 blocked across all projects
- **THEN** the status bar right side shows `3 ● working  1 ✓ review  1 ✗ blocked`

### Requirement: Live Window Naming
Window names SHALL be dynamically updated with status indicators (● working, ✓ review, ✗ blocked, ✓✓ approved) as engineer status changes.

#### Scenario: Window name updates on status change
- **WHEN** an engineer's `.worker-status` changes from `working` to `review`
- **THEN** the tmux window is renamed from `myapp/bd-a1b2 ●` to `myapp/bd-a1b2 ✓`

### Requirement: Hierarchical Window Ordering
Windows SHALL be ordered hierarchically: root orchestrator first, then status, then each project with its engineers grouped immediately after. New engineer windows SHALL be inserted after the last window of their project.

#### Scenario: Engineer window inserted in project group
- **WHEN** `orc spawn myapp bd-e5f6` is run and `myapp/bd-c3d4` is the last myapp window
- **THEN** the new window `myapp/bd-e5f6 ●` appears immediately after `myapp/bd-c3d4`

### Requirement: Pane Border Titles
Each pane SHALL have a labeled border title showing its role (engineering or review), the bead identifier, and relevant context (e.g., round number for review).

#### Scenario: Engineering pane shows title
- **WHEN** a worktree window is created for `bd-a1b2`
- **THEN** pane 0 border title shows `eng: myapp/bd-a1b2 (constraint-parser)`

#### Scenario: Review pane shows round
- **WHEN** a review pane is created for round 2
- **THEN** pane 1 border title shows `review: myapp/bd-a1b2 (round 2)`

### Requirement: Activity Monitoring
The tmux session SHALL have `monitor-activity` enabled so windows with new output are highlighted in the status bar.

#### Scenario: Active window highlights
- **WHEN** an engineer window produces output while the user is in a different window
- **THEN** the engineer's window tab is highlighted in the status bar

### Requirement: Detach as Exit
Detaching from tmux SHALL be the only exit mechanism. All agents continue running in the background after detach.

#### Scenario: Detach preserves sessions
- **WHEN** the user detaches from the orc tmux session (via `Ctrl-B d` or `/orc:leave`)
- **THEN** all agent sessions continue running
- **AND** running `orc` re-attaches to the existing session

### Requirement: Power User Compatibility
Orc SHALL NOT rebind any default tmux keybindings. All standard tmux commands (`Ctrl-B w`, `Ctrl-B d`, `Ctrl-B z`, `Ctrl-B [`, `Ctrl-B arrow`) SHALL work unmodified.

#### Scenario: Standard tmux keys work
- **WHEN** the user presses `Ctrl-B w` inside the orc session
- **THEN** the standard tmux window list is shown with orc's named and ordered windows

### Requirement: Session Styling
The orc tmux session SHALL be styled with a branded status bar (green `orc` label, dark background), numbered windows starting at 1, and `allow-rename off` to prevent running processes from overriding orc's dynamic naming.

#### Scenario: Branded session appearance
- **WHEN** the orc session is created
- **THEN** the status bar shows the orc brand with custom colors
- **AND** windows are numbered starting at 1
