---
name: view
description: Create or adjust tmux pane layouts for monitoring workers
argument-hint: "[layout description or pattern name]"
roles: [root-orchestrator, orchestrator, goal-orchestrator]
---

# /orc:view — Create Monitoring Layouts

**Role:** Orchestrator

Create or adjust tmux pane layouts for monitoring engineers and project state.

## Input

$ARGUMENTS

If no arguments provided, show current layout and available patterns.

## Layout Model

Each goal gets its own tmux window using **main-vertical** layout. The goal orchestrator is pane 0 — a **full-height left pane** (~60% width). All engineers and reviewers stack in the right column (~40% width).

```
┌──────────────────────┬──────────────┐
│                      │ eng: bd-a1   │
│  ⚔ goal: auth-bug   │              │
│  (pane 0)            ├──────────────┤
│  FULL HEIGHT         │ eng: bd-b2   │
│  ~60% width          │              │
│                      ├──────────────┤
│                      │ ✓ review:... │
│                      │ (ephemeral)  │
└──────────────────────┴──────────────┘
```

- **Goal orchestrators** get their own window via `orc spawn-goal` — they are pane 0 (left, full height).
- **Engineers** split into the right column of the goal window via `orc spawn`.
- **Review panes** split vertically below their engineer's pane (40% height, title: `"review: <project>/<bead>"`). Destroyed after each review round.
- **Goal windows ALWAYS use `main-vertical`.** Never apply `tiled` or other layouts to a goal window — it breaks the full-height orchestrator pane.

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

# Find the goal orchestrator (pane 0 in its window)
tmux list-panes -t "orc:<project>/<goal>" -F '#{pane_index}:#{pane_title}' | grep "goal: <name>"

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
