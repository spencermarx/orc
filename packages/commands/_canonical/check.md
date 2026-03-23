---
name: check
description: Poll worker statuses and handle review, blocked, or dead signals
roles: [orchestrator, goal-orchestrator]
---

# /orc:check — Poll Worker Statuses

**Role:** Orchestrator (project or goal)

Check on all active workers, handle status changes, and summarize. The behavior depends on your role:

- **Project orchestrator**: Poll goal orchestrator statuses (goal panes in the project window and overflow windows).
- **Goal orchestrator**: Poll engineer statuses (engineer panes in the goal window and overflow windows).

## Instructions (Project Orchestrator)

### Step 1 — List Active Goal Orchestrators

Each goal orchestrator runs in its own tmux window named `{project}/{goal}`. List goal windows by finding windows that match the `<project>/` prefix:
```bash
tmux list-windows -t orc -F '#{window_name}' | grep "^<project>/"
```

**IMPORTANT:** Always use **window names** (e.g., `orc:wrkbelt/WEN-874-booking`) when targeting tmux, never window indices (e.g., `orc:4`). Indices shift when windows are created or destroyed.

### Step 2 — Read Status for Each Goal Orchestrator

For each active goal orchestrator pane, derive the goal name from the pane title (e.g., `"goal: auth-bug"` → `auth-bug`). Check if the agent is still running (capture pane output) and read its per-goal status file at `.worktrees/.orc-state/goals/{goal}/.worker-status`.

#### Status: `working` (or agent is actively running)
No action needed. Note elapsed time if available.

#### Status: `review`
The goal orchestrator has completed all beads and is signaling for review.
1. Inspect the goal branch — check `git log` and `git diff main..<goal-branch>` to understand what was implemented.
2. Assess whether the implementation satisfies the original request.
3. **If satisfied:** Present results to the user. Do NOT teardown the goal — the user decides when cleanup happens.
4. **If not satisfied:** Write specific feedback to `.worktrees/.orc-state/goals/{goal}/.worker-feedback` so the goal orchestrator can address the issues.

**NEVER teardown a goal orchestrator or its worktree from `/orc:check`.** Teardown is the user's decision via `orc teardown`.

#### Status: `blocked: <reason>`
The goal orchestrator is stuck.
1. Read the block reason from `.worktrees/.orc-state/goals/{goal}/.worker-status`.
2. Evaluate if you can resolve it:
   - **Clarification needed**: Provide the answer and clear the block.
   - **Dependency issue**: Check if the blocking goal is close to done.
   - **Out of scope**: Escalate to the human.
3. If resolved, clear `.worktrees/.orc-state/goals/{goal}/.worker-status` back to `working` and notify the goal orchestrator.

#### Status: `dead` (or no running agent process)
The agent pane has crashed or exited unexpectedly.
1. Report the dead goal orchestrator with any available context.
2. Suggest options: relaunch with `orc spawn-goal` to respawn in the existing worktree, or ask the user if they want to teardown. **Do NOT teardown without user confirmation** — the worktree may contain uncommitted work.

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

Find all active engineer panes in the goal window (and any overflow windows like `<project>/<goal>:2`). Engineer panes have titles matching `"eng: <bead>"`. Also scan the `.worktrees/` directory for worktree paths.
```bash
tmux list-panes -t "orc:<project>/<goal>" -F '#{pane_index}:#{pane_title}' | grep "^.*:eng: "
# Also check overflow windows
tmux list-panes -t "orc:<project>/<goal>:2" -F '#{pane_index}:#{pane_title}' 2>/dev/null | grep "^.*:eng: "
```

### Step 2 — Read Status for Each Worker

For each active worktree, read the `.worker-status` file and handle accordingly:

#### Status: `working`
No action needed. Note elapsed time if available.

#### Status: `review`
The engineer has finished and is requesting review.
1. Run `orc review <project> <bead>` to launch the review pane.
2. The review agent will write its verdict to `.worker-feedback`.
3. **Wait for the reviewer to finish.** Monitor the review pane — when the reviewer has written its verdict and exited (or stopped responding), proceed.
4. **Immediately tear down the review pane** — it is ephemeral and must not persist after the verdict is written:
   ```bash
   # Find and kill the review pane by its title
   review_pane=$(tmux list-panes -t "orc:<project>/<goal>" -F '#{pane_index}:#{pane_title}' | grep "review: <project>/<bead>" | cut -d: -f1)
   if [ -n "$review_pane" ]; then
     tmux kill-pane -t "orc:<project>/<goal>.$review_pane"
   fi
   # Also check overflow windows
   ```
5. Read the verdict from `.worker-feedback`:
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
     - Mark the bead as done via `bd status <bead> done`.
     - Tear down ONLY the bead (not the goal): `orc teardown <project> <bead-id>`. This removes the engineer worktree and branch. **NEVER run `orc teardown <project> <goal>` here — that would destroy the goal worktree and kill your own session.**
   - **Not approved**: The feedback is already in `.worker-feedback`. Send a message to the engineering pane to trigger `/orc:feedback`, or note it for manual follow-up.

#### Status: `blocked: <reason>`
The engineer is stuck and has stopped.
1. Read the block reason.
2. If needed, spawn a scout sub-agent to investigate the context of the blocker — do not read source code yourself.
3. Evaluate if you can resolve it:
   - **Clarification needed**: Provide the answer and clear the block.
   - **Dependency issue**: Check if the blocking bead is close to done.
   - **Out of scope**: Escalate to the human.
4. If resolved, clear `.worker-status` back to `working` and notify the engineer.
   - Emit: `_orc_notify BLOCKED "<project>/<goal>/<bead>" "Engineer blocked: <reason>"`
   - On resolution: `_orc_resolve "<project>/<goal>/<bead>" "Block cleared"`

#### Status: `question: <question>`
The engineer needs clarification to proceed correctly.
1. Read the question from `.worker-status`.
2. Attempt to answer from plan context or by spawning a targeted scout sub-agent.
3. **If you can answer:**
   - Write the answer to `.worker-feedback`
   - Reset `.worker-status` to `working`
4. **If you cannot answer** (requires domain knowledge or user decision):
   - Emit notification: `_orc_notify QUESTION "<project>/<goal>/<bead>" "Engineer needs clarification: <question summary>"`
   - Highlight the pane: `_orc_pane_highlight "<project>/<goal>" <pane_index>`
   - Pause until the user provides the answer
   - Write answer to `.worker-feedback`, reset status to `working`
   - Resolve: `_orc_resolve "<project>/<goal>/<bead>" "Question answered"`
   - Clear: `_orc_pane_unhighlight "<project>/<goal>" <pane_index>`

#### Status: `dead` (or no running agent process)
The agent has crashed or exited unexpectedly.
1. Report the dead worker with any available context.
2. Suggest options: respawn in the same worktree, teardown, or manual inspection.

### Step 3 — Check for Discoveries and Plan Issues

Look for `found:` annotations in any `.worker-status` files:
- **`found: plan-issue — <description>`**: The plan itself needs revision. Emit `_orc_notify PLAN_INVALIDATED "<project>/<goal>" "Plan needs revision: <description>"`. Pause affected beads, re-engage the planner sub-agent, evaluate user involvement, re-decompose.
- **`found: <other>`**: Out-of-scope discovery. Create a new bead for it, set dependencies, add to queue. Surface to user.

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
