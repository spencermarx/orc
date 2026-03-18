## ADDED Requirements

### Requirement: Root Orchestrator Persona
The system SHALL provide `packages/personas/root-orchestrator.md` defining a conversational agent that coordinates across registered projects. The persona SHALL instruct the agent to: discuss high-level goals, decompose cross-project work into project-scoped directives, start project orchestrators via `orc start <project>`, and check status via `orc status`. The persona SHALL explicitly prohibit writing source code, managing beads, spawning engineers, or assuming project internals.

#### Scenario: Persona file exists at correct path
- **WHEN** the orc repository is installed
- **THEN** a readable persona file exists at `packages/personas/root-orchestrator.md`

#### Scenario: Persona includes prohibited actions section
- **WHEN** the root orchestrator persona is read
- **THEN** it contains a "you never" (or equivalent) section that explicitly lists writing source code, managing beads, spawning engineers, and assuming project internals as prohibited actions

### Requirement: Project Orchestrator Persona
The system SHALL provide `packages/personas/orchestrator.md` defining an agent that plans, sequences, dispatches, and reviews within a single project. The persona SHALL instruct the agent to: decompose goals into beads using the `bd` CLI, set bead dependencies, propose spawning engineers, manage the review loop (detect "review" in `.worker-status`, run `orc review`, read verdicts from `.worker-feedback`, track rounds), handle blocked engineers, and triage discovered out-of-scope work. The persona SHALL explicitly prohibit writing or editing application source code and merging without policy approval.

#### Scenario: Persona includes bd CLI commands for bead management
- **WHEN** the project orchestrator persona is read
- **THEN** it contains explicit `bd` CLI command examples or instructions for creating beads and setting dependencies

#### Scenario: Persona includes review loop instructions
- **WHEN** the project orchestrator persona is read
- **THEN** it contains instructions for detecting "review" in `.worker-status`, running `orc review`, and reading verdicts from `.worker-feedback`

#### Scenario: Persona includes prohibited actions section
- **WHEN** the project orchestrator persona is read
- **THEN** it contains a "you never" (or equivalent) section that explicitly lists writing or editing application source code and merging without policy approval as prohibited actions

### Requirement: Engineer Persona
The system SHALL provide `packages/personas/engineer.md` defining a principal-level software engineer working in an isolated git worktree. The persona SHALL instruct the agent to: read `.orch-assignment.md` for its task, investigate before implementing, follow the project's existing AI configuration (CLAUDE.md, .claude/, .ocr/), implement and test, self-review via `git diff`, signal status via `.worker-status` using the values working/review/blocked, and handle feedback from `.worker-feedback`. The persona SHALL explicitly prohibit git push, merge, PR creation, modifying `.beads/`, and leaving the worktree scope.

#### Scenario: Persona instructs reading assignment file first
- **WHEN** the engineer persona is read
- **THEN** it instructs the agent to read `.orch-assignment.md` as the first step before any implementation

#### Scenario: Persona defines worker-status signal protocol
- **WHEN** the engineer persona is read
- **THEN** it defines the three valid `.worker-status` values (working, review, blocked) and specifies when each SHALL be written

#### Scenario: Persona includes hard boundaries section
- **WHEN** the engineer persona is read
- **THEN** it contains a hard boundaries (or equivalent "you never") section listing git push, merge, PR creation, modifying `.beads/`, and leaving worktree scope as prohibited actions

### Requirement: Reviewer Persona
The system SHALL provide `packages/personas/reviewer.md` defining a senior code reviewer placed in an engineer's worktree. The persona SHALL instruct the agent to: read the assignment (`.orch-assignment.md`), examine changes via `git diff main`, read changed files in full context, run the project test suite and review tooling, evaluate against criteria (correctness, tests, conventions, edge cases, clarity, scope), and write a structured verdict to `.worker-feedback`. Approved verdicts SHALL start with `VERDICT: approved`. Not-approved verdicts SHALL start with `VERDICT: not-approved` followed by a `## Issues` section with file:line references. The persona SHALL explicitly prohibit modifying source code, modifying `.worker-status`, modifying `.beads/`, and approving work with failing tests.

#### Scenario: Persona defines verdict format with VERDICT line
- **WHEN** the reviewer persona is read
- **THEN** it specifies that verdicts written to `.worker-feedback` MUST begin with either `VERDICT: approved` or `VERDICT: not-approved`, and that not-approved verdicts MUST include a `## Issues` section with file:line references

#### Scenario: Persona includes review criteria checklist
- **WHEN** the reviewer persona is read
- **THEN** it contains an explicit list of review criteria covering at minimum: correctness, tests, conventions, edge cases, clarity, and scope

#### Scenario: Persona includes prohibited actions section
- **WHEN** the reviewer persona is read
- **THEN** it contains a "you never" (or equivalent) section that explicitly lists modifying source code, modifying `.worker-status`, modifying `.beads/`, and approving work with failing tests as prohibited actions

### Requirement: Persona Resolution Order
The system SHALL resolve personas in order: (1) project override at `{project}/.orc/{role}.md`, (2) repo default at `{orc-repo}/packages/personas/{role}.md`. Project personas are ADDITIVE — they do not replace CLAUDE.md, .claude/ rules, skills, or any existing project-level AI configuration.

#### Scenario: Project override takes precedence over repo default
- **WHEN** a persona file exists at both `{project}/.orc/{role}.md` and `{orc-repo}/packages/personas/{role}.md`
- **THEN** the project override at `{project}/.orc/{role}.md` is loaded in preference to the repo default

#### Scenario: Missing project override falls through to repo default
- **WHEN** no persona file exists at `{project}/.orc/{role}.md`
- **THEN** the repo default at `{orc-repo}/packages/personas/{role}.md` is loaded

#### Scenario: Persona loads alongside existing project AI config
- **WHEN** a persona is resolved for a project that has CLAUDE.md, .claude/ rules, or .ocr/ skills
- **THEN** the resolved persona is loaded in addition to, not instead of, the existing project AI configuration

### Requirement: Orchestrator Polling Behavior
The project orchestrator persona SHALL instruct the agent to periodically check `.worker-status` files in active worktrees to detect state changes. The persona SHALL specify that upon detecting `review`, the orchestrator initiates the review process; upon detecting `blocked`, the orchestrator reads the reason and responds; and upon detecting `found:` annotations, the orchestrator triages them.

#### Scenario: Persona instructs status polling
- **WHEN** the project orchestrator persona is read
- **THEN** it contains instructions for periodically checking `.worker-status` in active engineer worktrees

#### Scenario: Persona instructs found-line triage
- **WHEN** the project orchestrator persona is read
- **THEN** it contains instructions for reading `found:` annotations and deciding whether to create new beads or dismiss them

### Requirement: Engineer Discovery Protocol
The engineer persona SHALL instruct the agent to report out-of-scope discoveries by appending `found: <description>` lines to `.worker-status` after a blank line, below the current status signal.

#### Scenario: Persona defines found annotation format
- **WHEN** the engineer persona is read
- **THEN** it specifies the format for discovery annotations as `found: <description>` on lines after a blank line in `.worker-status`
