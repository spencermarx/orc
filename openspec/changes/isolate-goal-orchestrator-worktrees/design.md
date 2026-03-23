## Context

Goal orchestrators currently share the project root directory. This was inherited from the original design where goal orchestrators were lightweight coordinators that only issued git and bd commands against refs (never checking out branches). In practice, goal orchestrators delegate to planner sub-agents that may run planning tools which create files, check out branches, or stage changes — all of which pollute the shared workspace.

Engineers already get isolated worktrees via `orc spawn`. The same pattern should apply to goal orchestrators.

## Goals / Non-Goals

Goals:
- Each goal orchestrator runs in its own git worktree, checked out to its goal branch
- The developer's project root stays on its current branch (usually main), untouched by orc
- Multiple concurrent goals work in isolation without interfering with each other
- Planners and scouts spawned by the goal orchestrator inherit the worktree as their working directory
- Teardown cleans up goal worktrees alongside engineer worktrees

Non-Goals:
- Changing how engineers get their worktrees (already correct)
- Changing branch topology (beads still branch from goal branch)
- Changing the project orchestrator's workspace (it stays in project root — it only creates branches via `git branch`, never checks out)

## Decisions

### 1. Goal worktree naming: `.worktrees/goal-<name>`

Goal orchestrator worktrees live at `{project}/.worktrees/goal-<name>`. The `goal-` prefix distinguishes them from bead worktrees (which are named by bead ID, e.g., `.worktrees/bd-a1b2`). This keeps the existing `.worktrees/` convention and makes teardown straightforward.

### 2. Worktree is checked out to the goal branch

`git worktree add .worktrees/goal-<name> <goal-branch>` creates the worktree on the goal branch (e.g., `feat/WEN-886-booking-flow-name-decoupling`). The goal orchestrator and its sub-agents (planner, scouts) can freely modify files, create planning artifacts, and run tools without affecting the project root.

### 3. Engineer spawn unchanged

Engineers already branch from the goal branch ref: `git worktree add .worktrees/<bead> -b work/<goal>/<bead> <goal-branch>`. This uses the branch ref, not the checked-out state, so it works identically whether the goal branch is checked out in a worktree or not.

### 4. Status files stay in `.worktrees/.orc-state/goals/{goal}/`

Goal status files (`.worker-status`, `.worker-feedback`) remain at `.worktrees/.orc-state/goals/{goal}/` inside the project root, not inside the goal worktree. This is because the project orchestrator needs to read them, and it operates from the project root. The goal orchestrator writes to them using the project root path (accessible via `$ORC_ROOT` context or explicit path in its prompt).

### 5. Teardown adds goal worktree removal

`_teardown_goal` already kills goal windows, removes engineer worktrees, and deletes branches. Now it also removes `git worktree remove .worktrees/goal-<name>`. The worktree must be removed AFTER engineer worktrees (which may reference files in the goal worktree).

## Risks / Trade-offs

- **Disk usage**: one additional worktree per active goal. Worktrees are lightweight (they share the git object store), so impact is negligible.
- **Path references**: the goal orchestrator's init prompt currently references `${project_path}`. This must change to the worktree path for the working directory, while keeping the project path available for bd commands and status file access.
