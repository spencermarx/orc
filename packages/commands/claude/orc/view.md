# /orc:view — Create Monitoring Layouts

**Role:** Orchestrator

Create or adjust tmux pane layouts for monitoring engineers and project state.

## Input

$ARGUMENTS

If no arguments provided, show current layout and available patterns.

## Hub-and-Spoke Pane Model

Orc uses a hub-and-spoke layout where agents share windows as panes instead of getting one window each:

```
{project}                        ← Project window (hub)
  ├── pane 0: Project orchestrator
  ├── pane N: Goal orchestrator   (title: "goal: <name>")
  └── pane N+1: Goal orchestrator (title: "goal: <name>")

{project}/{goal}                 ← Goal window (spoke)
  ├── pane 0: Goal orchestrator
  ├── pane N: Engineer            (title: "eng: <bead>")
  └── pane N+1: Engineer          (title: "eng: <bead>")
```

- **Goal orchestrators** spawn as panes in the project window via `orc spawn-goal`.
- **Engineers** spawn as panes in the goal window via `orc spawn`. The goal window is created automatically when the first engineer for that goal is spawned.
- **Review panes** split horizontally from the engineer's pane (40% width, title: `"review: <project>/<bead>"`).

### Overflow Windows

When a window runs out of space (below `layout.min_pane_width` or `layout.min_pane_height`), new panes go into **overflow windows** with a `:N` suffix:

```
{project}       ← primary project window
{project}:2     ← first overflow
{project}:3     ← second overflow
{project}/{goal}:2  ← goal overflow
```

Overflow windows are created automatically and cleaned up during teardown. The system fills numbering gaps before creating new overflow windows.

### Pane Navigation

Panes are identified by their titles. Use these commands to find and interact with specific agents:

```bash
# List all panes in a window with their titles
tmux list-panes -t orc:<window> -F '#{pane_index}:#{pane_title}'

# Find a specific goal orchestrator pane
tmux list-panes -t "orc:<project>" -F '#{pane_index}:#{pane_title}' | grep "goal: <name>"

# Find a specific engineer pane (check overflow windows too)
tmux list-panes -t "orc:<project>/<goal>" -F '#{pane_index}:#{pane_title}' | grep "eng: <bead>"

# Capture output from a specific pane
tmux capture-pane -t "orc:<window>.<pane_index>" -p
```

## tmux Layout Primitives

You have access to these tmux commands for building monitoring layouts:

### Window Management
```bash
# List all windows
tmux list-windows -t orc -F '#{window_index}:#{window_name}'

# Create a new monitoring window
tmux new-window -t orc -n "monitor"
```

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

## Layout Configuration

```toml
[layout]
min_pane_width = 40    # Minimum columns per pane before overflow
min_pane_height = 10   # Minimum rows per pane before overflow
```

## Rules

1. **Never split an agent pane without asking the user first.** Agent panes (goal orchestrators, engineers) are actively running AI sessions. Splitting them can disrupt the agent.
2. Create new monitoring windows instead of modifying agent windows.
3. Use `watch` commands in monitoring panes so they auto-refresh.
4. Kill monitoring panes/windows when they are no longer needed to avoid clutter.
5. When looking for an agent, check overflow windows (`:2`, `:3`, etc.) in addition to the primary window.

## Responding to User Request

Based on the user's request in $ARGUMENTS:
1. Determine which layout pattern fits best.
2. Identify the relevant windows, overflow windows, and panes.
3. Build the layout using the primitives above.
4. Report what was created and how to navigate it (include pane titles for reference).
