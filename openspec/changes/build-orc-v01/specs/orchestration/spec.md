## ADDED Requirements

### Requirement: Root Orchestrator Session
The system SHALL provide `orc start` (invoked with no arguments) to start a root orchestrator session. It SHALL create a tmux window named `orc`, resolve the root-orchestrator persona using the configured persona resolution order, and launch the configured agent CLI with the persona content as the initial prompt.

#### Scenario: Start with no args creates root orchestrator tmux window
- **WHEN** `orc start` is invoked without arguments
- **THEN** a tmux window named `orc` is created and the agent CLI is launched inside it

#### Scenario: Agent CLI is invoked with root-orchestrator persona
- **WHEN** the root orchestrator session is started
- **THEN** the agent CLI is invoked with the resolved root-orchestrator persona content supplied as the initial prompt

### Requirement: Project Orchestrator Session
The system SHALL provide `orc start <project>` to start a project orchestrator session. It SHALL resolve the registered project path, create a tmux window named `{project}`, load the orchestrator persona, and launch the agent CLI in the project directory.

#### Scenario: Start with valid project creates project orchestrator window
- **WHEN** `orc start <project>` is invoked with a valid registered project key
- **THEN** a tmux window named `{project}` is created, the agent CLI is launched in the project directory with the orchestrator persona as the initial prompt

#### Scenario: Unknown project exits with error code 3
- **WHEN** `orc start <project>` is invoked with a key that does not exist in `projects.toml`
- **THEN** the command exits with exit code 3 and an error message identifying the unknown project

### Requirement: Engineer Spawning
The system SHALL provide `orc spawn <project> <bead>` to create an engineer worktree and launch an agent session. It SHALL: validate that the project and bead exist, verify that the current worker count does not exceed `max_workers`, check the configured spawn approval policy (`ask` or `auto`), create a git worktree at `{project-path}/.worktrees/{bead}/` on branch `work/{bead}`, write `.orch-assignment.md` from the output of `bd show`, write the string `working` to `.worker-status`, create a tmux window named `{project}/{bead}`, and launch the agent CLI with the engineer persona.

#### Scenario: Spawn creates worktree and tmux window
- **WHEN** `orc spawn <project> <bead>` is invoked with a valid project and bead, worker count is below `max_workers`, and the policy is `auto`
- **THEN** a git worktree is created at `{project-path}/.worktrees/{bead}/` on branch `work/{bead}`, `.orch-assignment.md` and `.worker-status` are written, a tmux window named `{project}/{bead}` is created, and the agent CLI is launched with the engineer persona

#### Scenario: Spawn at max_workers exits with state error
- **WHEN** `orc spawn <project> <bead>` is invoked and the current worker count equals `max_workers`
- **THEN** the command exits with exit code 2 and an error message stating the worker limit has been reached

#### Scenario: Spawn with ask policy prompts for confirmation
- **WHEN** `orc spawn <project> <bead>` is invoked and the spawn approval policy is `ask`
- **THEN** the user is prompted to confirm before the worktree and tmux window are created, and spawning proceeds only upon affirmative confirmation

#### Scenario: Spawn with existing worktree exits with state error
- **WHEN** `orc spawn <project> <bead>` is invoked and a worktree already exists at `{project-path}/.worktrees/{bead}/`
- **THEN** the command exits with exit code 2 and an error message indicating the worktree already exists

### Requirement: Engineer Halting
The system SHALL provide `orc halt <project> <bead>` to stop a running engineer session. It SHALL send an interrupt signal to the agent process running in the `{project}/{bead}` tmux window.

#### Scenario: Halt running engineer sends interrupt
- **WHEN** `orc halt <project> <bead>` is invoked and the `{project}/{bead}` tmux window exists with an active agent process
- **THEN** an interrupt signal is sent to the agent process in that tmux window

#### Scenario: Halt nonexistent worker exits with state error
- **WHEN** `orc halt <project> <bead>` is invoked and no tmux window named `{project}/{bead}` exists
- **THEN** the command exits with exit code 2 and an error message indicating the worker session was not found

### Requirement: Worktree Teardown
The system SHALL provide `orc teardown <project> <bead>` to clean up an engineer's worktree. It SHALL remove the git worktree at `{project-path}/.worktrees/{bead}/`, delete the `work/{bead}` branch, and close the `{project}/{bead}` tmux window if it is still open.

#### Scenario: Teardown removes worktree and branch
- **WHEN** `orc teardown <project> <bead>` is invoked for an existing worktree
- **THEN** the git worktree directory is removed and the `work/{bead}` branch is deleted

#### Scenario: Teardown closes tmux window
- **WHEN** `orc teardown <project> <bead>` is invoked and the `{project}/{bead}` tmux window is open
- **THEN** the tmux window is closed as part of teardown

#### Scenario: Teardown nonexistent worktree exits with state error
- **WHEN** `orc teardown <project> <bead>` is invoked and no worktree exists at `{project-path}/.worktrees/{bead}/`
- **THEN** the command exits with exit code 2 and an error message indicating the worktree was not found

### Requirement: Agent Adapter
The system SHALL launch agent CLIs using the configured `agent_cmd` and `agent_flags`. The default invocation pattern SHALL be `$agent_cmd $agent_flags --print "$prompt"`. If `agent_template` is set in configuration, the system SHALL use string interpolation with `{cmd}` and `{prompt}` placeholders to construct the invocation instead of the default pattern. To avoid shell metacharacter issues, the prompt content SHALL be written to a temporary file and passed to the agent CLI via file reference or stdin rather than inline shell argument.

#### Scenario: Default pattern uses agent_cmd with --print flag
- **WHEN** `agent_template` is not set and an agent session is launched
- **THEN** the agent CLI is invoked as `$agent_cmd $agent_flags --print "$prompt"` with the resolved persona as `$prompt`

#### Scenario: Custom template interpolates cmd and prompt
- **WHEN** `agent_template` is set in configuration and an agent session is launched
- **THEN** the agent CLI is invoked using the template string with `{cmd}` replaced by `agent_cmd` and `{prompt}` replaced by the resolved persona content

### Requirement: Worker Status File Format
The system SHALL define `.worker-status` as a plain text file at the worktree root. Line 1 SHALL contain exactly one of: `working`, `review`, or `blocked: <reason>`. Optional subsequent lines after a blank line MAY contain `found: <description>` annotations for out-of-scope discoveries. The orchestrator SHALL parse line 1 to determine worker state and scan subsequent lines for `found:` prefixed discoveries.

#### Scenario: Working status signal
- **WHEN** an engineer is actively implementing
- **THEN** `.worker-status` contains `working` on line 1

#### Scenario: Review status signal
- **WHEN** an engineer has completed implementation and is ready for review
- **THEN** `.worker-status` contains `review` on line 1

#### Scenario: Blocked status with reason
- **WHEN** an engineer is unable to proceed
- **THEN** `.worker-status` contains `blocked: <concise reason>` on line 1

#### Scenario: Discovery annotation
- **WHEN** an engineer discovers out-of-scope work during implementation
- **THEN** `.worker-status` contains the current status on line 1, a blank line, and one or more `found: <description>` lines

### Requirement: Discovery Triage
The orchestrator SHALL read `found:` lines from `.worker-status` files during status polling. For each discovery, the orchestrator SHALL evaluate whether it represents a genuine issue warranting a new bead or scope creep to be noted and ignored.

#### Scenario: Orchestrator triages discovery as new bead
- **WHEN** a `found:` annotation describes a legitimate issue outside the current bead's scope
- **THEN** the orchestrator creates a new bead via `bd create` with the discovery description

#### Scenario: Orchestrator dismisses scope creep
- **WHEN** a `found:` annotation describes work that is not necessary or is scope creep
- **THEN** the orchestrator notes the discovery without creating a bead
