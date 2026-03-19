# /orc:check — Poll Worker Statuses

**Role:** Orchestrator

Check on all active engineers, handle status changes, and summarize.

## Instructions

### Step 1 — List Active Worktrees

Find all active worktrees for this project by listing windows matching `<project>/*` pattern, or by scanning the `.worktrees/` directory.

### Step 2 — Read Status for Each Worker

For each active worktree, read the `.worker-status` file and handle accordingly:

#### Status: `working`
No action needed. Note elapsed time if available.

#### Status: `review`
The engineer has finished and is requesting review.
1. Run `orc review <project> <bead>` to launch the review plane.
2. The review agent will write its verdict to `.worker-feedback`.
3. After review completes, read the verdict:
   - **Approved**: Mark the bead as done. Proceed to teardown or merge based on `approval.merge` config.
   - **Not approved**: The feedback is already in `.worker-feedback`. Send a message to the engineering pane to trigger `/orc:feedback`, or note it for manual follow-up.

#### Status: `blocked: <reason>`
The engineer is stuck and has stopped.
1. Read the block reason.
2. Evaluate if you can resolve it:
   - **Clarification needed**: Provide the answer and clear the block.
   - **Dependency issue**: Check if the blocking bead is close to done.
   - **Out of scope**: Escalate to the human.
3. If resolved, clear `.worker-status` back to `working` and notify the engineer.

#### Status: `dead` (or no running agent process)
The agent has crashed or exited unexpectedly.
1. Report the dead worker with any available context.
2. Suggest options: respawn in the same worktree, teardown, or manual inspection.

### Step 3 — Check for Discoveries

Look for `found:` annotations in any `.worker-status` files. Discoveries are out-of-scope findings that may affect other beads or the overall plan. Surface them to the user.

### Step 4 — Summarize

Present a summary table:
```
Worker Status Summary:
  Working:  N engineers (list bead IDs)
  Review:   N engineers (list bead IDs) — action taken
  Blocked:  N engineers (list bead IDs + reasons)
  Dead:     N engineers (list bead IDs) — needs attention
  Found:    N discoveries — review recommended
```

Suggest next actions if any items need attention.
