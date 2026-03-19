## 1. Goals as Epic-Type Beads

- [ ] 1.1 Verify `bd ready` supports type filtering (test `bd ready --type epic` or equivalent); document workaround if not
- [ ] 1.2 Update `/orc:plan` (`plan.md`) project orchestrator section: create goals as `bd create --type epic` with dependencies via `bd dep add`
- [ ] 1.3 Update `/orc:dispatch` (`dispatch.md`) project orchestrator section: use `bd ready` filtered to epic type for wave dispatch
- [ ] 1.4 Update `/orc:check` (`check.md`) project orchestrator section: on goal completion, mark epic done via `bd status <epic> done`, then check `bd ready` for next wave and dispatch unblocked goals
- [ ] 1.5 Update `orchestrator.md` persona: document epic bead pattern, wave dispatch, `bd` commands for goal management
- [ ] 1.6 Update `/orc:plan` (`plan.md`) goal orchestrator section: create child beads with `--parent <epic-id>`
- [ ] 1.7 Update `goal-orchestrator.md` persona: document `--parent` usage for child beads

## 2. Goal Status Directory Infrastructure

- [ ] 2.1 Add `_goal_status_dir`, `_goal_signal`, `_goal_status` helpers to `_common.sh`
- [ ] 2.2 Update `spawn-goal.sh` to create `.orc/goals/<goal>/`, initialize `.worker-status` with `working`, write `.epic-id` with the goal's bead ID
- [ ] 2.3 Ensure `orc add` includes `.orc/` in the project's `.gitignore` (or warn if missing)
- [ ] 2.4 Update `teardown.sh` `_teardown_goal` to remove `.orc/goals/<goal>/` directory
- [ ] 2.5 Update `teardown.sh` `_teardown_project` to remove all `.orc/goals/` entries

## 3. Goal Orchestrator Writes to Scoped Path

- [ ] 3.1 Update `/orc:complete-goal` (`complete-goal.md`) to write to `.orc/goals/<goal>/.worker-status` instead of CWD (use `_goal_signal` helper path or explicit scoped path)
- [ ] 3.2 Update `goal-orchestrator.md` persona delivery section to reference scoped path
- [ ] 3.3 Remove any direct `echo > .worker-status` instructions that target the project root

## 4. Codebase Scouts

- [ ] 4.1 Update `/orc:plan` (`plan.md`) project orchestrator section: add Phase 1.5 (Scout) with discover → synthesize → follow-up lifecycle — Round 1 dispatches one scout per candidate goal area in parallel, each briefed with user request + goal description + instruction to map code/interfaces/data flows/test patterns
- [ ] 4.2 Update `/orc:plan` (`plan.md`) project orchestrator section: after Round 1, orchestrator synthesizes all scout reports to identify overlaps, shared code paths, sequencing constraints, and independent areas; optionally dispatches Round 2 follow-up scouts for ambiguous areas
- [ ] 4.3 Update `/orc:plan` (`plan.md`) goal orchestrator section: add Phase 1.5 (Scout) — dispatch scouts per area of the goal (API layer, data model, test infrastructure), collect reports, synthesize to identify coupling and sequencing within the goal
- [ ] 4.4 Include guidance that scouts should read the project's CLAUDE.md and `.claude/` rules for navigation context
- [ ] 4.5 Include guidance that scouting is recommended for non-trivial requests; orchestrator judges when warranted
- [ ] 4.6 Include guidance on the discover → synthesize → follow-up pattern: scouts discover territory, orchestrators synthesize cross-cutting concerns, follow-up scouts are optional and targeted

## 5. Delivery Roll-Up at Project Orchestrator

- [ ] 5.1 Update `/orc:check` (`check.md`) project orchestrator section to read from `.orc/goals/<goal>/.worker-status` instead of project root
- [ ] 5.2 Add delivery roll-up logic to `/orc:check`: when goal status is `review`, trigger delivery action per config (review mode: present summary; PR mode: call `_deliver_pr`)
- [ ] 5.3 Add aggregation: when multiple goals are `review`, batch into single user-facing summary
- [ ] 5.4 Update `orchestrator.md` persona to describe delivery roll-up behavior and user presentation format
- [ ] 5.5 Add feedback path: project orch writes `.worker-feedback` to `.orc/goals/<goal>/` when user has issues with a completed goal

## 6. Upstream Notification

- [ ] 6.1 Update `_goal_signal` helper to set `@orc_status` on the project window to `◆` when a goal signals `review` or `done`
- [ ] 6.2 Update `/orc:check` for root orchestrator to read `@orc_status` on project windows and report `◆` as "has completed goals"
- [ ] 6.3 Update `root-orchestrator.md` persona to describe notification handling and navigation guidance
- [ ] 6.4 Add logic to clear `◆` indicator on project window after project orch processes all completions

## 7. Status Dashboard

- [ ] 7.1 Update `status.sh` to read goal status from `.orc/goals/` directory (supplement or replace tmux window detection for goal state)
- [ ] 7.2 Show delivery state (branch name, PR URL) for completed goals
- [ ] 7.3 Group beads under parent epics in dashboard output using `bd` parent relationships
- [ ] 7.4 Include goal-level status in `--line` mode for tmux status bar

## 8. Validation

- [ ] 8.1 Manual test: spawn a goal, complete it, verify no `.worker-status` in project root and status exists in `.orc/goals/<goal>/`
- [ ] 8.2 Manual test: create two dependent goals (A → B), verify B only dispatches after A completes
- [ ] 8.3 Manual test: verify `orc status` shows goal delivery state from scoped directory
- [ ] 8.4 Manual test: verify project orchestrator detects completion via `/orc:check` and triggers delivery
- [ ] 8.5 Manual test: verify root orchestrator sees `◆` on project window when a goal completes
- [ ] 8.6 Manual test: verify codebase scouts are spawned during `/orc:plan` for a multi-goal request
