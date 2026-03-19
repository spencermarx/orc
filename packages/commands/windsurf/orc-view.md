# /orc:view — Create Monitoring Layouts

**Role:** Orchestrator

Create or adjust tmux pane layouts for monitoring engineers and project state.

## Input

$ARGUMENTS

If no arguments provided, show current layout and available patterns.

## tmux Layout Primitives

You have access to these tmux commands for building layouts:

### Window Naming
- Windows follow the convention: `<project>/<bead>` for worktrees, `<project>` for orchestrators
- Find windows: `tmux list-windows -t orc -F '#{window_index}:#{window_name}'`

### Splitting
```bash
# Horizontal split (top/bottom)
tmux split-window -t orc:<window> -v

# Vertical split (left/right)
tmux split-window -t orc:<window> -h

# Split and run a command in the new pane
tmux split-window -t orc:<window> -h "watch orc status"
```

### Layouts
```bash
# Apply a preset layout
tmux select-layout -t orc:<window> tiled          # Equal grid
tmux select-layout -t orc:<window> main-horizontal # Big top, small bottom row
tmux select-layout -t orc:<window> main-vertical   # Big left, small right column
tmux select-layout -t orc:<window> even-horizontal  # Equal columns
tmux select-layout -t orc:<window> even-vertical    # Equal rows
```

### Pane Management
```bash
# Resize panes
tmux resize-pane -t orc:<window>.<pane> -x 80     # Set width to 80 columns
tmux resize-pane -t orc:<window>.<pane> -y 20      # Set height to 20 rows

# Kill a pane
tmux kill-pane -t orc:<window>.<pane>

# Capture pane output (read what an agent is showing)
tmux capture-pane -t orc:<window>.<pane> -p
```

## Common Layout Patterns

### Monitor Grid
One pane per engineer showing their current status. Good for watching multiple workers.
```
tmux new-window -t orc -n "monitor"
# For each worker, split and run a watch command
tmux split-window -t orc:monitor "watch cat <worktree>/.worker-status"
tmux select-layout -t orc:monitor tiled
```

### Focus + Sidebar
Main pane for interactive work, sidebar showing status of all workers.
```
tmux split-window -t orc:<window> -h -l 30% "watch orc status"
```

### Project Dashboard
Orchestrator window with a compact status panel on the right.
```
tmux split-window -t orc:<project> -h -l 35%
tmux send-keys -t orc:<project>.1 "watch -n5 orc status" Enter
```

## Rules

1. **Never split an interactive agent window without asking the user first.** Agent windows (engineer worktrees) are actively running AI sessions. Splitting them can disrupt the agent.
2. Create new monitoring windows instead of modifying agent windows.
3. Use `watch` commands in monitoring panes so they auto-refresh.
4. Kill monitoring panes/windows when they are no longer needed to avoid clutter.

## Responding to User Request

Based on the user's request in $ARGUMENTS:
1. Determine which layout pattern fits best.
2. Identify the relevant windows and workers.
3. Build the layout using the primitives above.
4. Report what was created and how to navigate it.
