# Change: Isolate Goal Orchestrators in Dedicated Worktrees

## Why

Goal orchestrators currently run in the project root directory — the same directory the developer uses. When a goal orchestrator (or its planner sub-agent) runs git commands, creates files, or checks out the goal branch, it contaminates the developer's workspace. With multiple concurrent goals, all sharing the project root, this causes branch conflicts, uncommitted changes on the wrong branch, and teardown failures.

Engineers already get isolated worktrees. Goal orchestrators should too.

## What Changes

**`spawn-goal.sh`** — create a git worktree for the goal orchestrator at `.worktrees/goal-<name>`, checked out to the goal branch. The tmux window's working directory becomes the worktree, not the project root.

**`teardown.sh`** — `_teardown_goal` removes the goal orchestrator's worktree (alongside engineer worktrees it already cleans up).

**Goal orchestrator persona** — update context to reflect that the goal orchestrator runs in its own worktree, not the project root. Planning tools and planner sub-agents also run in this worktree.

**Planner persona** — update to clarify it operates in the goal worktree, not the project root.

## Impact

- Affected specs: goal-workspace-isolation (new)
- Affected code:
  - `packages/cli/lib/spawn-goal.sh` — create worktree, launch agent in worktree
  - `packages/cli/lib/teardown.sh` — remove goal worktree on teardown, skip `goal-*` in project iteration
  - `packages/personas/goal-orchestrator.md` — update context, status file paths, boundaries
  - `packages/personas/planner.md` — update operating directory
  - `packages/cli/lib/spawn.sh` — no changes (engineers already branch from goal branch ref, not checkout state)
- Affected docs:
  - `docs/concepts.md` — worktrees section, sub-agents section
  - `docs/tmux-layout.md` — goal window working directory
  - `docs/planning.md` — planner operating directory
  - `README.md` — architecture section if applicable
  - `CLAUDE.md` — architecture section if applicable
  - `migrations/CHANGELOG.md` — new entry for goal worktree isolation
