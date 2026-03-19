# /orc:dispatch — Spawn Engineers for Ready Beads

**Role:** Orchestrator

Check for ready beads and spawn engineer agents in isolated worktrees.

## Instructions

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

Check the `approval.spawn` config:
- If `"ask"`: Present the list of beads to spawn and ask for human confirmation.
- If `"auto"`: Proceed automatically.

Present:
```
Ready to spawn N engineers:
  bd-XXXX  <title>   — <brief description>
  bd-XXXX  <title>   — <brief description>

Spawn these engineers? [Y/n]
```

### Step 5 — Spawn Engineers

For each approved bead, run:
```bash
orc spawn <project> <bead-id>
```

This creates the worktree, launches the agent, and delivers the assignment via `.orch-assignment.md`.

Report results:
```
Spawned:
  bd-XXXX  <title>   — worktree created, agent launched
  bd-XXXX  <title>   — worktree created, agent launched

Run `/orc:check` to monitor progress.
```
