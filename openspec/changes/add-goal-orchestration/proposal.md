# Change: Add Goal-Level Orchestration Layer

## Why

Today, orc decomposes user work into beads and dispatches engineers 1:1
into worktrees — but there is no entity between "the user's request" and
"individual beads." This creates three concrete problems:

1. **No coordinated branch.** Each bead gets its own `work/<bead>` branch
   that merges independently to main. A feature that spans 5 beads produces
   5 separate merges, polluting main with partial work and making atomic
   rollback impossible.

2. **No aggregate progress.** `orc status` shows bead-level detail but
   cannot answer "how far along is the auth feature?" There is no grouping
   concept to roll individual bead statuses up into.

3. **No delivery lifecycle.** The orchestrator's job ends at review
   approval. There is no consolidation step, no PR creation, and no way
   for the user to review the combined work before it hits main.

The user's mental model is: "I give you a bug/feature/task → you produce
one branch → I review one PR." The current architecture forces: "I give
you a bug/feature/task → you produce N branches → I manually merge N
things."

## What Changes

- **New concept: Goal** — A named unit of delivery that groups related
  beads. Each goal owns a long-lived branch (`goal/<name>`) that beads
  merge into, not main.

- **New tier: Goal Orchestrator** — Replaces the direct project
  orchestrator → engineer relationship. The project orchestrator creates
  goals and delegates each to a goal orchestrator. The goal orchestrator
  owns the planning, dispatching, engineering, and review loop for its
  beads. This absorbs the current engineering/review management that the
  project orchestrator performs today.

- **Updated hierarchy:**
  ```
  Root Orchestrator → Project Orchestrator → Goal Orchestrator(s) → Engineers + Reviewers
  ```

- **Updated branch topology:** Bead worktrees branch from the goal branch
  instead of main. On bead approval, work fast-forward merges to the goal
  branch. When all beads complete, the goal branch contains the full
  deliverable.

- **Configurable branch naming:** Goal branches use type-based prefixes
  by default (`feat/`, `fix/`, `task/`) with optional ticket prefixes
  (e.g., `feat/WEN-123-add-sso`). Users can describe their preferred
  branch naming convention in natural language via `[branching] strategy`
  in config. Resolution follows most-specific-wins (project > global).

- **Two-mode delivery lifecycle:** When all beads complete, the goal
  orchestrator enters delivery. Default mode is "review" — the goal
  branch is presented for the user to inspect and provide feedback via
  any agent plane. Alternative mode is "pr" — the goal orchestrator
  pushes and creates a PR via `gh` to a configurable target branch. The
  system never merges to main unless the user explicitly requests it.

- **Configurable PR target branch:** When in PR mode, the target branch
  is determined by a natural language `[delivery] target_strategy` field
  (supporting gitflow, trunk-based, or custom models). Inline user
  instructions take highest precedence over config.

- **Updated `orc status`:** Shows goal-level aggregation
  ("fix-auth: 3/5 beads done") in addition to bead detail.

- **Updated tmux layout:** Goal orchestrators get their own windows,
  with bead worktrees nested underneath.

- **Optional Ruflo enhancement:** When Ruflo (formerly ClaudeFlow) is
  installed and explicitly enabled via `[agents] ruflo = "auto"`, orc
  starts the Ruflo MCP server and injects a lightweight enhancement
  block into agent personas at spawn time. Off by default — users
  without Ruflo never see any reference to it.

## Impact

- Affected specs: goal-lifecycle (new), orchestration-hierarchy (new),
  branch-topology (new), ruflo-integration (new)
- Affected code:
  - `packages/cli/lib/spawn.sh` — branch from goal branch, not main
  - `packages/cli/lib/teardown.sh` — goal-level teardown + branch cleanup
  - `packages/personas/orchestrator.md` — becomes project orchestrator
    (delegates to goal orchestrators)
  - `packages/personas/` — new `goal-orchestrator.md` persona
  - `packages/commands/claude/orc/plan.md` — creates goals, not just beads
  - `packages/commands/claude/orc/dispatch.md` — dispatches goal
    orchestrators, not engineers directly
  - `packages/commands/claude/orc/check.md` — polls goal orchestrators
  - `packages/cli/lib/_common.sh` — new helpers for goal branches
  - `config.toml` — new `[delivery]` section (mode + target_strategy),
    new `[branching]` section (strategy)
  - `openspec/config.yaml` — updated domain concepts and tiers
