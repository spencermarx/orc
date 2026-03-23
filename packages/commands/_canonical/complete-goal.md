---
name: complete-goal
description: Trigger delivery when all beads and goal-level review are complete
roles: [goal-orchestrator]
---

# /orc:complete-goal — Signal Goal Complete

**Role:** Goal Orchestrator

Trigger delivery when all beads for this goal are done.

## Instructions

### Step 1 — Verify All Beads Are Complete

Run `bd list` and verify that every bead assigned to this goal has status `done` (or equivalent). If any beads are still in progress, blocked, or pending review:

```
Cannot complete goal — outstanding beads:
  bd-XXXX  <title>  status: <status>
```

Do not proceed until all beads are complete.

### Step 2 — Verify Goal Branch Integrity

Check that the goal branch contains all expected bead merges:

```bash
# Show commits on the goal branch that are not on main
git log main..<goal-branch> --oneline
```

Verify the commit history looks correct — each approved bead should have been fast-forward merged.

### Step 3 — Run Tests

Run the project's test suite against the goal branch to verify the integrated work passes:

```bash
# Use whatever test command the project defines
# Check package.json scripts, Makefile, or CLAUDE.md for test instructions
```

If tests fail, identify which bead's changes caused the failure and report it. Do not proceed with delivery.

### Step 3.5 — Verify Goal-Level Review Completed

**Note:** The goal-level review loop (`[review.goal]`) runs BEFORE this command is called. It is managed by the goal orchestrator's monitoring loop, not by `/orc:complete-goal`. By the time you reach this step, the goal review should already be approved.

If `[review.goal] review_instructions` is configured, verify the review has been completed and approved before proceeding. If it hasn't, do NOT proceed — return to the goal-level review loop.

### Step 4 — Read Delivery Configuration

Read `[delivery.goal] on_completion_instructions` and `[delivery.goal] when_to_involve_user_in_delivery` from the config chain.

### Step 5a — No delivery configured (default)

If `on_completion_instructions` is empty:

1. Signal completion by writing `review` to `.worktrees/.orc-state/goals/{goal}/.worker-status`
2. Present a summary of what was accomplished
3. Emit: `_orc_notify GOAL_COMPLETE "<project>/<goal>" "Goal delivered"` (immediately resolved — informational)
4. **STOP.** Wait for the project orchestrator to review the goal branch.

### Step 5b — Delivery instructions configured

If `on_completion_instructions` is set:

1. **Evaluate user involvement**: read `when_to_involve_user_in_delivery` (defaults to "always" if empty)
   - If involvement needed: emit `_orc_notify DELIVERY "<project>/<goal>" "Goal ready for delivery, awaiting approval"` and **pause** for user approval
   - On resume: `_orc_resolve "<project>/<goal>" "Delivery approved"`
2. **Execute delivery instructions**: follow the natural-language instructions directly. Common actions:
   - `git push -u origin <goal-branch>` — push the branch
   - `gh pr create --base <target> --head <goal-branch> --title "..." --body "..."` — create PR
   - Ticket updates — if the instructions mention ticket actions, execute them (these take precedence over `[tickets] strategy` for the completion moment)
   - Slash commands — if instructions reference a slash command, run it
3. **Signal completion**: write `done` to `.worktrees/.orc-state/goals/{goal}/.worker-status`
4. Emit: `_orc_notify GOAL_COMPLETE "<project>/<goal>" "Goal delivered"` (immediately resolved)

### Step 6 — STOP

**STOP here.** Do not start new work. The goal is delivered.
