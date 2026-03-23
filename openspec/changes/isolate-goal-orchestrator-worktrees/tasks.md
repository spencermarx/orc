## 1. Goal Orchestrator Worktree Creation

- [x] 1.1 Update `spawn-goal.sh` to create a git worktree at `.worktrees/goal-{goal}` checked out to the goal branch before creating the tmux window
- [x] 1.2 Update `spawn-goal.sh` to set the tmux window working directory to the goal worktree path (not the project root)
- [x] 1.3 Update `spawn-goal.sh` init prompt to include both the worktree path (working directory) and the project root path (for bd commands and status files)
- [x] 1.4 Handle the relaunch case: if the goal worktree already exists (from a previous dead session), reuse it instead of failing

## 2. Teardown

- [x] 2.1 Update `_teardown_goal` in `teardown.sh` to remove the goal worktree at `.worktrees/goal-{goal}` AFTER removing engineer worktrees
- [x] 2.2 Update `_teardown_project` to skip `goal-*` entries in `.worktrees/` during its bead iteration (they are handled by `_teardown_goal`, not `_teardown_bead`). Also detect goals from goal worktrees (read goal name from `goal-*` dir name) in addition to detecting from bead branch patterns.

## 3. Persona Updates

- [x] 3.1 Update goal orchestrator persona Context section — reflect that the goal orchestrator runs in a dedicated worktree checked out to the goal branch, not in the project root
- [x] 3.2 Update goal orchestrator persona Status File Paths section — clarify that status files are at `{project-root}/.worktrees/.orc-state/goals/{goal}/`, accessed via the project root path provided in the init prompt (not a path inside the worktree)
- [x] 3.3 Update planner persona — change "You operate within the project directory" to "You operate within the goal worktree"
- [x] 3.4 Update goal orchestrator Boundaries section — remove "Never checkout branches" rule (now unnecessary since the goal orch has its own worktree on the goal branch)

## 4. Documentation Updates

- [x] 4.1 Update `docs/concepts.md` Worktrees section — mention that goal orchestrators also get worktrees (not just engineers). Update the `.worktrees/` description.
- [x] 4.2 Update `docs/concepts.md` Sub-Agents section — note that planners and scouts run in the goal worktree
- [x] 4.3 Update `docs/tmux-layout.md` — note that goal windows open in the goal worktree directory
- [x] 4.4 Update `docs/planning.md` — note that the planner operates in the goal worktree where it can freely create artifacts
- [x] 4.5 Update `README.md` Architecture / Agent Hierarchy section if it references goal orch running in project root
- [x] 4.6 Update `CLAUDE.md` Architecture section if it references goal orch workspace
- [x] 4.7 Update `migrations/CHANGELOG.md` — add entry for goal worktree isolation

## 5. Smoke Testing

- [x] 5.1 Manually verify: `orc spawn-goal` creates a worktree at `.worktrees/goal-{name}` on the goal branch
- [x] 5.2 Manually verify: the project root stays on main after spawning goal orchestrators
- [x] 5.3 Manually verify: the planner sub-agent creates artifacts inside the goal worktree
- [x] 5.4 Manually verify: engineer spawn still works (branches from goal branch ref)
- [x] 5.5 Manually verify: `orc teardown <project> <goal>` removes the goal worktree
- [x] 5.6 Manually verify: `orc teardown <project>` removes all goal worktrees
- [x] 5.7 Manually verify: multiple concurrent goals each get their own worktree without interference
