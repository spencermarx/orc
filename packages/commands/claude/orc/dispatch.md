# /orc:dispatch — Spawn Goal Orchestrators or Engineers

**Role:** Orchestrator (project or goal)

The behavior depends on your role:

- **Project orchestrator**: Spawn goal orchestrators for planned goals.
- **Goal orchestrator**: Spawn engineers for ready beads.

## Instructions (Project Orchestrator)

### Step 1 — Identify Ready Goals

Check which goals have their branches created and are ready to be worked on. If goals have dependencies on other goals, only dispatch goals whose dependencies are complete.

If no goals are ready:
- Check if any are blocked by incomplete dependencies
- Report the current state and suggest waiting or re-planning

### Step 2 — Check Spawn Approval

Run `echo $ORC_YOLO` to check the mode.

**If `ORC_YOLO=1` (YOLO mode):** Do NOT ask for confirmation. Do NOT present a table and ask "Shall I proceed?". Just immediately run `orc spawn-goal` for every ready goal. No questions, no delays.

**If `ORC_YOLO` is not `1` (normal mode):** Present the list and ask:
```
Ready to spawn N goal orchestrators:
  <goal-name>  (<type>) — <brief description>

Spawn these goal orchestrators? [Y/n]
```

### Step 3 — Spawn Goal Orchestrators

For each approved goal:
```bash
orc spawn-goal <project> <goal-name>
```

**IMPORTANT:** Pass only the bare goal name (e.g., `hierarchical-pane-layout`), NOT the full branch name (e.g., `task/hierarchical-pane-layout`). The type prefix (`feat/`, `fix/`, `task/`) is resolved automatically by the CLI.

This creates a tmux window for the goal orchestrator, launches the agent with the goal-orchestrator persona, and the goal orchestrator will handle planning, bead creation, engineer dispatching, and review within its scope.

Report results briefly, then **immediately begin monitoring**. Do NOT wait for the user to ask — start polling automatically:

1. Wait ~60 seconds for goal orchestrators to start planning
2. Run `/orc:check` to poll statuses
3. Handle any signals (review, blocked, dead)
4. Wait ~90 seconds, poll again
5. Repeat until all goal orchestrators are done or blocked

## Instructions (Goal Orchestrator)

### Step 1 — Find Ready Beads

Run `bd ready` to list beads whose dependencies are satisfied and that are not yet assigned.

If no beads are ready:
- Check if any are blocked by incomplete dependencies
- Report the current state and suggest waiting or re-planning

### Step 2 — Check Worker Capacity

Check how many workers are currently active (from `orc status`). Compare against the configured `max_workers` limit (default: 4 per project).

If at capacity: "At max workers (N). Wait for current engineers to finish or increase `max_workers` in config."

### Step 3 — Verify Bead Context

For each ready bead, confirm it has:
- A clear title and description
- Defined acceptance criteria
- No unresolved blockers

If any bead is missing context, flag it and skip it.

### Step 4 — Check Spawn Approval

Run `echo $ORC_YOLO` to check the mode.

**If `ORC_YOLO=1` (YOLO mode):** Do NOT ask for confirmation. Do NOT present a table and ask "Shall I proceed?". Just immediately run `orc spawn` for every ready bead. No questions, no delays.

**If `ORC_YOLO` is not `1` (normal mode):** Present the list and ask:
```
Ready to spawn N engineers:
  bd-XXXX  <title>   — <brief description>

Spawn these engineers? [Y/n]
```

### Step 5 — Spawn Engineers

Always pass the goal name so engineers branch from the goal branch:
```bash
orc spawn <project> <bead-id> <goal>
```

This creates the worktree, launches the agent, and delivers the assignment via `.orch-assignment.md`.

Report results briefly, then **immediately begin monitoring**. Do NOT wait for the user to ask — start polling automatically:

1. Wait ~30 seconds for engineers to start
2. Run `/orc:check` to poll statuses
3. Handle any signals (review, blocked, dead)
4. Wait ~60 seconds, poll again
5. Repeat until all engineers are done or blocked
6. When a wave completes, check `bd ready` and dispatch the next wave
