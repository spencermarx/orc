# Tasks: Add Goal-Level Orchestration

## Phase 1 — Branch Topology & Goal CLI Primitives

- [ ] 1.1 Add `[branching] strategy` field to `config.toml` with empty
      default and documentation comment
- [ ] 1.2 Add `_config_get_branching_strategy` helper to `_common.sh`
      that resolves the branch naming strategy (project > local > global)
- [ ] 1.3 Add `_create_goal_branch` helper to `_common.sh` that creates
      a goal branch (e.g., `feat/<name>`, `fix/<name>`, `task/<name>`)
      from main HEAD
- [ ] 1.4 Add `_merge_bead_to_goal` helper to `_common.sh` that
      fast-forward merges a bead branch into its goal branch (rebase
      first if ff not possible, escalate on conflict)
- [ ] 1.5 Add `_delete_goal_branch` helper to `_common.sh` for cleanup
- [ ] 1.6 Modify `spawn.sh` to accept an optional goal name; when
      provided, branch worktree from the goal branch and name the bead
      branch `work/<goal>/<bead>`
- [ ] 1.7 Modify `teardown.sh` to support goal-level teardown: tear down
      all beads under a goal, kill goal orchestrator window, delete goal
      branch and all `work/<goal>/*` bead branches
- [ ] 1.8 Smoke test: manually create a goal branch with type prefix,
      spawn a bead from it, verify worktree is based on goal branch,
      verify ff-merge works, teardown cleans up all branches

## Phase 2 — Persona Persistence with Custom Review

- [ ] 2.0a Modify `review.sh` so that when `[review] command` is set,
      the reviewer agent is STILL launched with orc's `reviewer.md`
      persona as `--append-system-prompt`, and the custom command
      (e.g., `/ocr:review`) is sent as the agent's initial prompt/task
      rather than replacing the entire agent launch
- [ ] 2.0b Smoke test: configure `[review] command` to any custom
      command, spawn a review, verify the agent has the orc reviewer
      persona AND runs the custom command as its first action

## Phase 3 — Goal Orchestrator Persona & Commands

- [ ] 3.1 Create `packages/personas/goal-orchestrator.md` defining the
      goal orchestrator role as a separate agent session, including:
      commands, boundaries, monitoring loop, branch naming strategy
      interpretation, and ff-merge responsibilities
- [ ] 3.2 Create `/orc:plan-goal` slash command (or extend `/orc:plan`)
      for goal-level bead decomposition within a goal context
- [ ] 3.3 Update `/orc:dispatch` to handle goal-level dispatch (spawn
      engineers from goal branch, label beads with `goal:<name>`)
- [ ] 3.4 Update `/orc:check` for goal orchestrator context (ff-merge
      approved beads to goal branch, rebase if needed)
- [ ] 3.5 Add `/orc:complete-goal` slash command for the goal
      orchestrator to trigger delivery workflow (review mode: signal
      completion and present branch; PR mode: push + create PR via `gh`
      to configured target branch)
- [ ] 3.6 Smoke test: launch goal orchestrator as separate agent session,
      have it plan and dispatch beads, verify review loop works with
      ff-merge to goal branch

## Phase 4 — Project Orchestrator Updates

- [ ] 4.1 Update `packages/personas/orchestrator.md` to remove direct
      engineer management, add goal creation and goal orchestrator
      dispatching, include branch naming strategy delegation
- [ ] 4.2 Add `orc spawn-goal <project> <goal>` CLI command (or extend
      `orc spawn`) to launch goal orchestrator as separate agent session
      in its own tmux window
- [ ] 4.3 Update `/orc:plan` to create goals (with type-prefixed
      branches), propose semantic goal names for user confirmation,
      support user-provided names, and handle ticket prefixes
- [ ] 4.4 Update `/orc:dispatch` for project orchestrator context to
      dispatch goal orchestrators instead of engineers
- [ ] 4.5 Update `/orc:check` for project orchestrator context to poll
      goal-level status instead of individual bead workers
- [ ] 4.6 Smoke test: project orchestrator creates 2 goals with different
      types (feat/ and fix/), dispatches goal orchestrators as separate
      agent sessions, each manages its own beads independently

## Phase 5 — Status, Layout & Delivery

- [ ] 5.1 Update `orc status` to show goal-level aggregation (goal name,
      branch, bead progress, active engineers)
- [ ] 5.2 Update tmux window naming to support three-level hierarchy
      (`project/goal/bead`) with goal orchestrator as a distinct agent
      plane
- [ ] 5.3 Add `[delivery]` section to config.toml with `mode = "review"`
      (default) and `target_strategy = ""` (natural language PR target
      branch description)
- [ ] 5.4 Implement two-mode delivery: review mode (signal completion,
      present branch for user inspection via any agent plane) and PR mode
      (push via `gh`, create PR to target determined by `target_strategy`,
      defaulting to main/default branch)
- [ ] 5.5 Update `_last_project_window` and window ordering helpers for
      three-level naming
- [ ] 5.6 Smoke test: end-to-end workflow — user request → goals with
      type-prefixed branches → beads → engineering → review → ff-merge
      to goal branch → delivery (both review mode and PR mode)

## Phase 6 — Optional Ruflo Enhancement

- [ ] 6.1 Add `[agents] ruflo = "off"` field to `config.toml` with a
      one-line comment (no explanation block — invisible to most users)
- [ ] 6.2 Add `_detect_ruflo` helper to `_common.sh`: checks
      `command -v ruflo` then `npx ruflo --version`, caches result in
      `$ORC_RUFLO_AVAILABLE` for the session. Only runs when config is
      `"auto"` or `"require"`. Returns immediately when `"off"`.
- [ ] 6.3 Add `_ensure_ruflo_mcp` helper to `_common.sh`: verifies
      Ruflo MCP server is registered via `claude mcp list`, registers
      via `claude mcp add` if needed, starts if not running. Called once
      before first agent spawn in a project session.
- [ ] 6.4 Add `_ruflo_persona_block` helper to `_common.sh`: returns a
      short (~15 line) enhancement block for persona injection, or empty
      string when Ruflo is off/unavailable. Content is hardcoded in the
      helper, not read from external files.
- [ ] 6.5 Modify `_launch_agent_in_window` to append Ruflo persona block
      (if non-empty) to the persona content at spawn time. No disk writes
      — injection happens in memory only.
- [ ] 6.6 Smoke test: verify `ruflo = "off"` produces zero Ruflo
      references in spawned agents. Verify `ruflo = "auto"` without
      Ruflo installed produces zero references. Verify `ruflo = "require"`
      without Ruflo exits with clear error.

## Phase 7 — Documentation & Config

- [ ] 7.1 Update `openspec/config.yaml` domain concepts and tiers to
      reflect four-tier hierarchy and branch naming
- [ ] 7.2 Update CLAUDE.md architecture section
- [ ] 7.3 Update config.toml with `[branching] strategy` field and
      `[delivery]` section (mode + target_strategy) with documentation
- [ ] 7.4 Add goal orchestrator to persona resolution chain in _common.sh
