## ADDED Requirements

### Requirement: Setup Instructions Configuration

The system SHALL provide a `[worktree]` configuration section with a `setup_instructions` field that accepts natural language instructions for project-specific worktree bootstrapping.

The field SHALL:
- Follow the WHO/WHEN/WHAT/BOUNDARY documentation pattern used by all lifecycle hook fields
- Support a `{project_root}` placeholder that resolves to the absolute path of the registered project root
- Default to empty (no setup)
- Participate in the standard config resolution order: project `.orc/config.toml` > `config.local.toml` > `config.toml`

#### Scenario: Setup instructions configured
- **WHEN** a project has `[worktree] setup_instructions = "Run pnpm install. Copy .env from {project_root}."`
- **THEN** the `{project_root}` placeholder is replaced with the project's absolute path at launch time
- **AND** the resolved instructions are available for injection into agent init prompts

#### Scenario: Setup instructions empty
- **WHEN** a project has no `setup_instructions` configured (or it is empty)
- **THEN** no setup preamble is added to agent init prompts
- **AND** agents start their normal workflow immediately

### Requirement: Setup Injection for Engineers

The system SHALL inject worktree setup instructions into engineer init prompts as a "FIRST:" preamble, executed before reading `.orch-assignment.md`.

#### Scenario: Engineer spawned with setup instructions
- **WHEN** `orc spawn myapp bd-a1b2 my-goal` is run
- **AND** the project has `setup_instructions` configured
- **THEN** the engineer's init prompt begins with the setup preamble
- **AND** the engineer executes setup before reading its assignment

### Requirement: Setup Injection for Goal Orchestrators

The system SHALL inject worktree setup instructions into goal orchestrator init prompts as a "FIRST:" preamble, executed before codebase investigation.

#### Scenario: Goal orchestrator spawned with setup instructions
- **WHEN** `orc spawn-goal myapp my-goal` is run
- **AND** the project has `setup_instructions` configured
- **THEN** the goal orchestrator's init prompt begins with the setup preamble
- **AND** the goal orchestrator executes setup before investigating the codebase

### Requirement: Setup Injection for Project Orchestrators

The system SHALL inject worktree setup instructions into project orchestrator init prompts when the project orchestrator runs in a worktree, as a "FIRST:" preamble.

#### Scenario: Project orchestrator launched with setup instructions
- **WHEN** `orc myapp` is run and a project orchestrator worktree is created
- **AND** the project has `setup_instructions` configured
- **THEN** the project orchestrator's init prompt begins with the setup preamble

### Requirement: Root Orchestrator Excluded

The root orchestrator SHALL NOT receive worktree setup instructions. The root orchestrator runs in the orc repo root, not in a project worktree.

#### Scenario: Root orchestrator launched
- **WHEN** `orc` is run (no project argument)
- **THEN** no setup preamble is added to the root orchestrator's init prompt

### Requirement: Schema Validation

The `worktree.setup_instructions` field SHALL be registered in the config schema used by `orc doctor` for validation.

#### Scenario: Doctor validates worktree field
- **WHEN** `orc doctor` is run on a config containing `[worktree] setup_instructions`
- **THEN** the field is recognized as valid
- **AND** no unknown-field warning is emitted
