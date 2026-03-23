# planner-persona Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Planner Ephemeral Sub-Agent

The system SHALL provide a planner persona (`packages/personas/planner.md`) defining an ephemeral sub-agent that creates planning artifacts on behalf of the goal orchestrator.

The planner SHALL:
- Receive the goal description, acceptance criteria, and scout findings as context
- Execute the tool or instructions specified in `plan_creation_instructions`
- Create planning artifacts (design docs, task lists, spec deltas, etc.) as required by the planning tool
- Return the location and summary of what was produced
- Operate within the project directory (not in a worktree)

The planner SHALL NOT:
- Write application source code
- Decompose the goal into beads (the goal orchestrator does this)
- Dispatch engineers or manage the review loop
- Make orchestration decisions
- Modify bead state or worker status files

#### Scenario: Planner creates OpenSpec proposal
- **WHEN** `plan_creation_instructions = "/openspec:proposal"`
- **THEN** the goal orchestrator spawns a planner sub-agent
- **AND** the planner runs `/openspec:proposal` with the goal context
- **AND** creates `proposal.md`, `tasks.md`, optional `design.md`, and spec deltas
- **AND** returns the change directory path and summary to the goal orchestrator

#### Scenario: Planner follows natural language instructions
- **WHEN** `plan_creation_instructions = "Create a technical design doc covering architecture decisions and migration steps in .orc-state/goals/{goal}/plan.md"`
- **THEN** the planner creates the specified document with the requested content
- **AND** returns confirmation to the goal orchestrator

#### Scenario: Planner receives scout findings
- **WHEN** the goal orchestrator has completed codebase investigation via scouts
- **THEN** the planner sub-agent receives the synthesized scout findings as part of its briefing
- **AND** uses this codebase context to produce a grounded, realistic plan

### Requirement: Planner Delegation Pattern

The goal orchestrator SHALL always delegate plan creation to an ephemeral planner sub-agent and SHALL NOT run `plan_creation_instructions` in its own context.

This follows the same delegation pattern as:
- Scouts: investigate codebase → return findings (goal orch never reads source code directly)
- Reviewers: review goal branch → return verdict (goal orch never runs review tools directly)
- Planner: create plan artifacts → return plan location (goal orch never runs planning tools directly)

#### Scenario: Goal orchestrator delegates to planner
- **WHEN** `plan_creation_instructions` is configured
- **THEN** the goal orchestrator spawns an ephemeral planner sub-agent (via Agent tool)
- **AND** briefs the planner with: goal description, acceptance criteria, scout findings, and the `plan_creation_instructions` value
- **AND** waits for the planner to complete
- **AND** reads the plan artifacts for decomposition

#### Scenario: Goal orchestrator never runs planning tools directly
- **WHEN** `plan_creation_instructions` contains a slash command like `/openspec:proposal`
- **THEN** the goal orchestrator does NOT execute the slash command itself
- **AND** delegates execution to the planner sub-agent

### Requirement: Planner Persona Override

The planner persona SHALL follow the standard persona resolution chain: `{project}/.orc/planner.md` > `{orc-repo}/packages/personas/planner.md`.

Users MAY customize the planner persona per project to add project-specific planning conventions, tool usage patterns, or output format requirements.

#### Scenario: Project-level planner persona override
- **WHEN** a project has `.orc/planner.md`
- **THEN** the planner sub-agent uses the project-level persona instead of the default
- **AND** the project persona may include project-specific planning conventions

