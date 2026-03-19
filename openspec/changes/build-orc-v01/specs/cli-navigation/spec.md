## ADDED Requirements

### Requirement: Positional Navigation
The CLI SHALL support three positional navigation patterns: `orc` (root orchestrator), `orc <project>` (project orchestrator), and `orc <project> <bead>` (engineer worktree). Reserved subcommand names SHALL be checked before positional routing.

#### Scenario: No arguments opens root orchestrator
- **WHEN** the user runs `orc` with no arguments
- **THEN** the root orchestrator session is created or re-attached

#### Scenario: Single argument opens project orchestrator
- **WHEN** the user runs `orc myproject` where `myproject` is a registered project
- **THEN** the project orchestrator session is created or re-attached

#### Scenario: Two arguments opens engineer worktree
- **WHEN** the user runs `orc myproject bd-a1b2` and the worktree window exists
- **THEN** the user is focused to the worktree's engineering pane

#### Scenario: Non-existent worktree shows error
- **WHEN** the user runs `orc myproject bd-xxxx` and no such worktree window exists
- **THEN** an error is shown listing active worktrees for that project

#### Scenario: Reserved name takes precedence
- **WHEN** the user runs `orc status` (a reserved subcommand)
- **THEN** the `status` subcommand is dispatched, not treated as a project name

### Requirement: CWD-Aware Project Detection
When `orc` is run with no arguments from inside a registered project directory, the CLI SHALL detect the project and offer to open its orchestrator instead of root.

#### Scenario: CWD inside registered project
- **WHEN** the user runs `orc` from inside a registered project directory
- **THEN** the CLI prompts: "You're in <project>. Open its orchestrator? [Y/n]"
- **AND** pressing Enter or Y opens the project orchestrator
- **AND** pressing n opens the root orchestrator

#### Scenario: CWD not inside any project
- **WHEN** the user runs `orc` from a directory not inside any registered project
- **THEN** the root orchestrator is opened directly

### Requirement: Admin Subcommands
The CLI SHALL provide the following admin subcommands: `init`, `add`, `remove`, `list`, `status`, `halt`, `teardown`, `config`, `board`. These SHALL be checked before positional routing.

#### Scenario: Admin command dispatch
- **WHEN** the user runs `orc <subcommand>` where `<subcommand>` matches a reserved name
- **THEN** the corresponding subcommand script is sourced and executed

### Requirement: Internal Subcommands
The CLI SHALL provide `spawn` and `review` as internal subcommands hidden from help text but functional when invoked directly.

#### Scenario: Spawn creates worktree and engineer
- **WHEN** `orc spawn <project> <bead>` is run
- **THEN** a git worktree is created, an engineer agent is launched, and orc slash commands are installed into the worktree

#### Scenario: Review launches review pane
- **WHEN** `orc review <project> <bead>` is run
- **THEN** a review pane is created in the worktree's tmux window

### Requirement: Global Flags
The CLI SHALL support `--yolo`, `--help`/`-h`, and `--version`/`-v` as global flags parsed before dispatch.

#### Scenario: Yolo flag enables auto-accept
- **WHEN** the user runs `orc --yolo` or `orc --yolo myproject`
- **THEN** `ORC_YOLO=1` is exported and agent sessions are launched with auto-accept flags

#### Scenario: Help flag shows usage
- **WHEN** the user runs `orc --help` or `orc -h`
- **THEN** help text is displayed showing navigation patterns and admin commands

### Requirement: Reserved Name Validation
The `orc add` command SHALL reject project keys that collide with reserved subcommand names.

#### Scenario: Reject reserved name as project key
- **WHEN** the user runs `orc add status /path/to/project`
- **THEN** the command fails with an error explaining the name conflicts with a subcommand

### Requirement: Portable Symlink Resolution
The CLI SHALL resolve symlinks using a portable loop function that works on macOS (BSD readlink) and Linux (GNU readlink) without requiring `readlink -f`.

#### Scenario: Symlink resolved on macOS
- **WHEN** `orc` is invoked via a symlink on macOS
- **THEN** `ORC_ROOT` resolves to the correct repository root
