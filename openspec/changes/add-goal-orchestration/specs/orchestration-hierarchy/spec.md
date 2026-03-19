## ADDED Requirements

### Requirement: Four-Tier Orchestration Hierarchy

The system SHALL implement a four-tier agent hierarchy:

1. **Root Orchestrator** — coordinates across projects, never writes code
2. **Project Orchestrator** — decomposes user requests into goals,
   dispatches goal orchestrators, monitors goal-level progress
3. **Goal Orchestrator** — owns one goal (feature/bug/task), decomposes
   into beads, dispatches engineers, manages the review loop, merges
   approved beads to the goal branch, and raises a PR when complete
4. **Engineers** — implement one bead in an isolated worktree, signal
   review when done

Each tier SHALL have a dedicated persona markdown file defining its role,
commands, and boundaries.

#### Scenario: User provides a feature request

- **WHEN** a user provides a feature request to the project orchestrator
- **THEN** the project orchestrator creates a goal with a named branch
- **AND** delegates execution to a goal orchestrator agent
- **AND** the goal orchestrator decomposes the goal into beads, dispatches
  engineers, and manages the review loop

#### Scenario: User provides multiple tasks

- **WHEN** a user provides multiple bugs/features/tasks to the project
  orchestrator
- **THEN** the project orchestrator creates one goal per task
- **AND** dispatches a separate goal orchestrator for each goal
- **AND** each goal orchestrator operates independently

### Requirement: Project Orchestrator Role Boundary

The project orchestrator SHALL NOT directly spawn engineers or manage the
review loop. It SHALL delegate all bead-level execution to goal
orchestrators. The project orchestrator's responsibilities are:

- Receiving user requests and decomposing them into goals
- Creating goal branches
- Dispatching goal orchestrators
- Monitoring goal-level progress (not bead-level)
- Escalating cross-goal issues to the user

#### Scenario: Project orchestrator delegates to goal orchestrator

- **WHEN** the project orchestrator creates a goal with beads
- **THEN** it spawns a goal orchestrator in a dedicated tmux window
- **AND** the goal orchestrator receives the goal definition and bead list
- **AND** the project orchestrator does not directly interact with
  engineers

### Requirement: Goal Orchestrator Responsibilities

The goal orchestrator SHALL run as a separate agent session (its own
agent process in a dedicated tmux window) and SHALL own the full
execution lifecycle for a single goal:

- Decomposing the goal into beads (refining from project orchestrator's
  initial breakdown if needed)
- Dispatching engineers for ready beads (branching from the goal branch)
- Running the autonomous monitoring loop (poll every 60s)
- Managing the review loop (launch reviewers, read verdicts, send feedback)
- Merging approved bead branches into the goal branch via fast-forward
  merge (rebase first if necessary, escalate on conflict)
- Raising a PR when all beads are complete (per approval policy)
- Escalating blocked engineers or max-review-round situations

#### Scenario: Goal orchestrator runs full lifecycle

- **WHEN** a goal orchestrator is spawned with a goal definition
- **THEN** it runs as its own agent session in a dedicated tmux window
- **AND** it creates beads, dispatches engineers, monitors progress
- **AND** fast-forward merges each approved bead into the goal branch
- **AND** raises a PR from goal branch to main when all beads complete
- **AND** reports completion to the project orchestrator

#### Scenario: Goal orchestrator escalates

- **WHEN** an engineer is blocked and the goal orchestrator cannot resolve
  it
- **THEN** the goal orchestrator escalates to the project orchestrator
- **AND** the project orchestrator escalates to the user if needed

### Requirement: Orc Personas Persist with Custom Review Commands

The system SHALL always inject orc's engineer and reviewer personas as
system prompts, regardless of any user-configured review process. When
the user configures a custom `[review] command` (e.g., `/ocr:review`),
the orc reviewer persona SHALL still be loaded as the agent's system
prompt. The custom command runs as the agent's initial task, not as a
replacement for the persona.

This ensures the reviewer agent always knows:
- How to read `.orch-assignment.md` for context
- How to write structured verdicts to `.worker-feedback`
- Its boundaries (never modify source code, never touch `.beads/`)

The same applies to engineer personas — orc's engineer persona SHALL
always be present as the system prompt, even when the user configures
custom workflows, slash commands, or review tools in the engineer's
session.

The `[review] command` field controls **what the reviewer does first**
(its initial task), not **what the reviewer is** (its persona/identity).

#### Scenario: Custom review command with orc persona

- **WHEN** `[review] command` is set to any custom command (e.g., a
  slash command, a script, or a CLI tool)
- **THEN** the review pane agent is launched with orc's `reviewer.md`
  persona as system prompt
- **AND** the custom command is sent as the agent's initial task
- **AND** the agent evaluates the command's output against
  `.orch-assignment.md` and writes a `.worker-feedback` verdict

#### Scenario: Custom review producing actionable feedback

- **WHEN** the reviewer runs a custom review command that produces
  output identifying issues
- **THEN** the reviewer (still operating under orc's reviewer persona)
  evaluates the output against `.orch-assignment.md`
- **AND** writes a structured `VERDICT: not-approved` with issues to
  `.worker-feedback`
- **AND** the goal orchestrator can then route this feedback to the
  engineer pane

#### Scenario: Default review (no custom command)

- **WHEN** `[review] command` is empty (default)
- **THEN** the reviewer is launched with orc's `reviewer.md` persona
- **AND** runs the default review process (read diff, run tests, write
  verdict)
- **AND** behavior is unchanged from current implementation

#### Scenario: Engineer persona persists with custom workflows

- **WHEN** the user configures custom slash commands or tools for
  engineers
- **THEN** orc's `engineer.md` persona is still loaded as the system
  prompt
- **AND** the engineer retains knowledge of `.orch-assignment.md`,
  `.worker-status` signaling, and scope boundaries

### Requirement: Engineer Role Unchanged

Engineers SHALL continue to work in isolated worktrees with a single bead
assignment. The only change is that their worktree branches from the goal
branch instead of main.

#### Scenario: Engineer works on bead in goal branch

- **WHEN** an engineer is spawned for a bead under a goal
- **THEN** the worktree is created from the goal branch
  (`goal/<goal-name>`)
- **AND** the engineer reads `.orch-assignment.md` and implements normally
- **AND** the engineer signals review via `.worker-status` as before
