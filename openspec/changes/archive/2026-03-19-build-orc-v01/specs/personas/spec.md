## ADDED Requirements

### Requirement: Root Orchestrator Persona
The root orchestrator persona SHALL reference positional navigation (`orc <project>`), slash commands (`/orc`, `/orc:status`, `/orc:view`, `/orc:leave`), and instruct the agent to run `orc status` on entry and proactively orient the user.

#### Scenario: Root orchestrator orients user on entry
- **WHEN** the root orchestrator agent session starts
- **THEN** the agent runs `orc status` and surfaces which engineers need attention

### Requirement: Project Orchestrator Persona
The project orchestrator persona SHALL reference slash commands (`/orc:plan`, `/orc:dispatch`, `/orc:check`, `/orc:view`, `/orc:leave`), internal CLI commands (`orc spawn`, `orc review`), and the review loop workflow (detect review signal → launch review pane → read verdict → send feedback or mark done).

#### Scenario: Orchestrator manages review loop
- **WHEN** the project orchestrator detects `.worker-status` reads "review"
- **THEN** it follows the review loop: launch review pane, read verdict, send feedback or mark done

### Requirement: Engineer Persona
The engineer persona SHALL reference slash commands (`/orc:done`, `/orc:blocked`, `/orc:feedback`, `/orc:leave`) and instruct the agent to read `.orch-assignment.md`, implement, test, self-review, and signal via `.worker-status`. Engineers SHALL NOT reference tmux or layout commands.

#### Scenario: Engineer uses slash commands for workflow
- **WHEN** the engineer finishes implementation
- **THEN** the engineer runs `/orc:done` which handles self-review, commit, and signaling

### Requirement: Reviewer Persona
The reviewer persona SHALL instruct the agent to review the diff, run tests, check for correctness/coverage/conventions/edge-cases/scope, and write a structured verdict to `.worker-feedback`.

#### Scenario: Reviewer writes structured verdict
- **WHEN** the reviewer completes its review
- **THEN** `.worker-feedback` contains `VERDICT: approved` or `VERDICT: not-approved` with structured issues

### Requirement: Persona Resolution
Persona files SHALL be resolved in order: `{project}/.orc/{role}.md` (project override) then `{orc-repo}/packages/personas/{role}.md` (default). Project personas are additive — they do not replace CLAUDE.md, .claude/ rules, or existing AI config.

#### Scenario: Project override takes precedence
- **WHEN** `myapp/.orc/engineer.md` exists
- **THEN** it is used instead of `packages/personas/engineer.md` for myapp engineers
