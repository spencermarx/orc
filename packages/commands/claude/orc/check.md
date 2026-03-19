# /orc:check — Poll Worker Statuses

**Role:** Orchestrator (project or goal)

Check on all active workers, handle status changes, and summarize. The behavior depends on your role:

- **Project orchestrator**: Poll goal orchestrator statuses (goal-level windows).
- **Goal orchestrator**: Poll engineer statuses (bead-level worktrees).

## Instructions (Project Orchestrator)

### Step 1 — List Active Goal Orchestrators

Find all active goal orchestrator windows for this project by listing tmux windows matching `<project>/<goal>` pattern (one level deep, not `<project>/<goal>/<bead>`).

### Step 2 — Read Status for Each Goal Orchestrator

For each active goal orchestrator window, check if the agent is still running and read its `.worker-status` file (at the project root, not in a worktree).

#### Status: `working` (or agent is actively running)
No action needed. Note elapsed time if available.

#### Status: `review`
The goal orchestrator has completed all beads and is signaling for review.
1. Inspect the goal branch — check `git log` and `git diff main..<goal-branch>` to understand what was implemented.
2. Assess whether the implementation satisfies the original request.
3. **If satisfied:** Mark the goal as complete. Teardown the goal orchestrator window if appropriate.
4. **If not satisfied:** Write specific feedback to the goal orchestrator's `.worker-feedback` file so it can address the issues.

#### Status: `blocked: <reason>`
The goal orchestrator is stuck.
1. Read the block reason.
2. Evaluate if you can resolve it:
   - **Clarification needed**: Provide the answer and clear the block.
   - **Dependency issue**: Check if the blocking goal is close to done.
   - **Out of scope**: Escalate to the human.
3. If resolved, clear `.worker-status` back to `working` and notify the goal orchestrator.

#### Status: `dead` (or no running agent process)
The agent has crashed or exited unexpectedly.
1. Report the dead goal orchestrator with any available context.
2. Suggest options: relaunch with `orc spawn-goal`, teardown, or manual inspection.

### Step 3 — Summarize

Present a summary:
```
Goal Orchestrator Status Summary:
  Working:    N goals (list goal names)
  Review:     N goals (list goal names) — action taken
  Blocked:    N goals (list goal names + reasons)
  Dead:       N goals (list goal names) — needs attention
  Complete:   N goals (list goal names)
```

Suggest next actions if any items need attention.

## Instructions (Goal Orchestrator)

### Step 1 — List Active Worktrees

Find all active worktrees for this project by listing windows matching `<project>/<goal>/*` pattern, or by scanning the `.worktrees/` directory.

### Step 2 — Read Status for Each Worker

For each active worktree, read the `.worker-status` file and handle accordingly:

#### Status: `working`
No action needed. Note elapsed time if available.

#### Status: `review`
The engineer has finished and is requesting review.
1. Run `orc review <project> <bead>` to launch the review plane.
2. The review agent will write its verdict to `.worker-feedback`.
3. After review completes, read the verdict:
   - **Approved**:
     - Fast-forward merge the bead branch into the goal branch. The bead branch is `work/<goal>/<bead>` and the goal branch is `feat/<goal>`, `fix/<goal>`, or `task/<goal>`. Run the merge from the project root:
       ```bash
       # Fast-forward merge (no checkout needed)
       git -C <project_path> fetch . work/<goal>/<bead>:<goal-branch>
       ```
       If fast-forward fails (branches have diverged), rebase the bead branch onto the goal branch first:
       ```bash
       git -C <project_path> rebase <goal-branch> work/<goal>/<bead>
       # Then retry the fast-forward merge
       git -C <project_path> fetch . work/<goal>/<bead>:<goal-branch>
       ```
       If rebase has conflicts, **escalate to the human** — do not force merge.
     - Mark the bead as done. Proceed to teardown based on `approval.merge` config.
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

### Step 5 — Check Goal Completion

If ALL beads for this goal are complete (no working, review, or blocked engineers remain):
- Run `/orc:complete-goal` to trigger delivery
