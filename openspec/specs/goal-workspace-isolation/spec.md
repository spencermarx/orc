# goal-workspace-isolation Specification

## Purpose
TBD - created by archiving change isolate-goal-orchestrator-worktrees. Update Purpose after archive.
## Requirements
### Requirement: Goal Orchestrator Worktree

The system SHALL create a dedicated git worktree for each goal orchestrator, isolating it from the project root and from other concurrent goal orchestrators.

The worktree SHALL:
- Be located at `{project}/.worktrees/goal-{goal-name}` (the `goal-` prefix distinguishes from bead worktrees)
- Be checked out to the goal branch (e.g., `feat/WEN-886-booking-flow-name-decoupling`)
- Serve as the working directory for the goal orchestrator's tmux window
- Be the working directory for all sub-agents spawned by the goal orchestrator (planner, scouts)

The project root SHALL remain on its current branch (typically `main`) and SHALL NOT be modified by any orc goal orchestrator or sub-agent.

#### Scenario: Goal orchestrator spawned in isolated worktree
- **WHEN** `orc spawn-goal myapp WEN-886-booking-flow` is run
- **THEN** a git worktree is created at `.worktrees/goal-WEN-886-booking-flow`
- **AND** the worktree is checked out to the goal branch `feat/WEN-886-booking-flow`
- **AND** the tmux window `myapp/WEN-886-booking-flow` opens with working directory set to the worktree
- **AND** the project root remains on `main` with no uncommitted changes

#### Scenario: Multiple concurrent goal orchestrators
- **WHEN** three goals are dispatched concurrently
- **THEN** three separate worktrees are created: `goal-WEN-886-...`, `goal-WEN-885-...`, `goal-notification-mgmt`
- **AND** each goal orchestrator works in its own worktree
- **AND** changes in one worktree do not affect the others or the project root

#### Scenario: Planner sub-agent runs in goal worktree
- **WHEN** the goal orchestrator delegates plan creation to a planner sub-agent
- **THEN** the planner operates in the goal worktree, not the project root
- **AND** planning artifacts are created within the goal worktree

### Requirement: Goal Worktree Teardown

The system SHALL remove goal orchestrator worktrees during teardown, in addition to the existing engineer worktree cleanup.

The teardown sequence SHALL:
1. Remove all engineer worktrees for the goal (existing behavior)
2. Remove the goal orchestrator worktree at `.worktrees/goal-{goal-name}`
3. Kill the goal tmux window (existing behavior)
4. Delete the goal branch (existing behavior)
5. Remove the goal status directory (existing behavior)

The goal worktree SHALL be removed AFTER engineer worktrees (which may reference the goal branch).

#### Scenario: Goal teardown removes goal worktree
- **WHEN** `orc teardown myapp WEN-886-booking-flow` is run
- **THEN** all engineer worktrees for the goal are removed
- **AND** the goal worktree at `.worktrees/goal-WEN-886-booking-flow` is removed
- **AND** the goal branch is deleted
- **AND** the project root is unaffected

#### Scenario: Project teardown removes all goal worktrees
- **WHEN** `orc teardown myapp` is run
- **THEN** all goal worktrees are removed alongside all engineer worktrees

### Requirement: Goal Status File Location

Goal orchestrator status files SHALL remain at `.worktrees/.orc-state/goals/{goal}/` within the project root directory, not inside the goal worktree.

This is because the project orchestrator reads these files from the project root. The goal orchestrator writes to them using the project root path provided in its initial prompt.

#### Scenario: Goal orchestrator writes status from worktree
- **WHEN** the goal orchestrator needs to write `.worker-status`
- **THEN** it writes to `{project-root}/.worktrees/.orc-state/goals/{goal}/.worker-status`
- **AND** NOT to a path inside its own worktree

#### Scenario: Project orchestrator reads goal status
- **WHEN** `/orc:check` polls goal orchestrator statuses
- **THEN** it reads from `.worktrees/.orc-state/goals/{goal}/.worker-status` in the project root
- **AND** this path is accessible regardless of which worktree the goal orchestrator is in

### Requirement: Engineer Spawn Compatibility

Engineer worktree creation SHALL continue to work identically with goal orchestrator worktrees. The `orc spawn` command branches from the goal branch ref, not from the checked-out state of any worktree.

No changes to `spawn.sh` SHALL be required.

#### Scenario: Engineer spawned while goal orch is in worktree
- **WHEN** an engineer is spawned for a bead in a goal with an active goal worktree
- **THEN** the engineer worktree is created at `.worktrees/{bead}` branching from the goal branch ref
- **AND** the engineer worktree is independent of the goal worktree

