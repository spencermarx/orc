## ADDED Requirements

### Requirement: CLI Entry Point
The system SHALL provide a `bin/orc` entry point that dispatches subcommands via case statement, sources `_common.sh` for shared helpers, and displays help text when invoked with no arguments or `--help`.

#### Scenario: Invoke with no arguments shows help
- **WHEN** `orc` is invoked with no arguments
- **THEN** help text is displayed and the process exits with code 0

#### Scenario: Invoke with unknown subcommand shows error and help
- **WHEN** `orc` is invoked with an unrecognized subcommand
- **THEN** an error message naming the unknown subcommand is printed, help text is displayed, and the process exits with code 1

#### Scenario: Invoke with valid subcommand dispatches to script
- **WHEN** `orc` is invoked with a recognized subcommand
- **THEN** control is dispatched to the corresponding subcommand script with all remaining arguments forwarded

### Requirement: Shared Helpers
The system SHALL provide `_common.sh` with: ORC_ROOT resolution (follow orc symlink via readlink), TOML config reader with three-layer resolution (project `.orc/config.toml` > `config.local.toml` > `config.toml`), project lookup from `projects.toml`, tmux window management helpers, prerequisite checker, and formatted output functions (info/warn/error).

#### Scenario: Resolves ORC_ROOT from symlink
- **WHEN** `_common.sh` is sourced and `bin/orc` is a symlink
- **THEN** `ORC_ROOT` resolves to the real directory containing the orc installation via `readlink`

#### Scenario: Reads config with correct precedence
- **WHEN** a config key is present in multiple layers
- **THEN** the project-level `.orc/config.toml` value takes precedence over `config.local.toml`, which takes precedence over `config.toml`

#### Scenario: Looks up project path by key
- **WHEN** a project key is provided to the project lookup helper
- **THEN** the corresponding project path is returned from `projects.toml`

#### Scenario: Validates prerequisites exist on PATH
- **WHEN** the prerequisite checker is called for a required tool
- **THEN** if the tool is missing from PATH an error message is printed and the process exits with a non-zero code

### Requirement: Exit Codes
The system SHALL use standardized exit codes: 0 (success), 1 (usage error), 2 (state error), 3 (project not found).

#### Scenario: Usage error returns 1
- **WHEN** a command is invoked with invalid arguments or an unknown subcommand
- **THEN** the process exits with code 1

#### Scenario: State error returns 2
- **WHEN** a command fails due to an invalid state (e.g., a worktree already exists)
- **THEN** the process exits with code 2

#### Scenario: Unknown project returns 3
- **WHEN** a command references a project key that is not present in `projects.toml`
- **THEN** the process exits with code 3

### Requirement: Prerequisite Validation
The system SHALL validate that required tools (`bd`, `tmux`, `git`, and an agent CLI) are available on PATH before executing commands that depend on them. The agent CLI command is read from config (`defaults.agent_cmd`).

#### Scenario: Missing bd exits with error
- **WHEN** `bd` is not found on PATH and a command that requires it is invoked
- **THEN** an error message naming `bd` as the missing tool is printed and the process exits with a non-zero code

#### Scenario: Missing tmux exits with error
- **WHEN** `tmux` is not found on PATH and a command that requires it is invoked
- **THEN** an error message naming `tmux` as the missing tool is printed and the process exits with a non-zero code

#### Scenario: Missing agent CLI exits with error naming the configured command
- **WHEN** the command specified in `defaults.agent_cmd` is not found on PATH
- **THEN** an error message naming the configured agent command as the missing tool is printed and the process exits with a non-zero code
