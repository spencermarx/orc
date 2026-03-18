## ADDED Requirements

### Requirement: Project Initialization
The system SHALL provide `orc init` to bootstrap a new orc installation. It SHALL symlink `bin/orc` to `~/.local/bin/orc` (or `/usr/local/bin` if `~/.local/bin` is not on `$PATH`), create `config.local.toml` and `projects.toml` if not present and add them to `.gitignore`, verify prerequisites (`bd`, `tmux`, `git`, and the configured agent CLI), and suggest board tools if none are configured.

#### Scenario: First run creates gitignored files
- **WHEN** `orc init` is run in a directory without `config.local.toml` or `projects.toml`
- **THEN** both files are created with default content and appended to `.gitignore`

#### Scenario: Re-run is idempotent
- **WHEN** `orc init` is run a second time in a directory where files already exist
- **THEN** no files are overwritten and no duplicate `.gitignore` entries are added

#### Scenario: Missing prerequisites listed with install hints
- **WHEN** `orc init` is run and one or more prerequisites (`bd`, `tmux`, `git`, agent CLI) are not found on `$PATH`
- **THEN** each missing tool is listed by name along with an install hint, and initialization completes with exit code 2

### Requirement: Project Registration
The system SHALL provide `orc add <key> <path>` to register a project. It SHALL validate that the given path exists on disk and that the key is not already present in `projects.toml`, then append the key-path entry to `projects.toml`.

#### Scenario: Add valid project succeeds
- **WHEN** `orc add <key> <path>` is invoked with a unique key and an existing path
- **THEN** the key-path pair is appended to `projects.toml` and a confirmation message is printed

#### Scenario: Duplicate key exits with error
- **WHEN** `orc add <key> <path>` is invoked with a key that already exists in `projects.toml`
- **THEN** the command exits with exit code 2 and an error message identifying the duplicate key

#### Scenario: Nonexistent path exits with error
- **WHEN** `orc add <key> <path>` is invoked with a path that does not exist on disk
- **THEN** the command exits with exit code 1 and an error message identifying the invalid path

### Requirement: Project Removal
The system SHALL provide `orc remove <key>` to unregister a project. It SHALL validate that the key exists in `projects.toml` before removing it.

#### Scenario: Remove existing project succeeds
- **WHEN** `orc remove <key>` is invoked with a key that exists in `projects.toml`
- **THEN** the entry is removed from `projects.toml` and a confirmation message is printed

#### Scenario: Remove unknown key exits with error
- **WHEN** `orc remove <key>` is invoked with a key that does not exist in `projects.toml`
- **THEN** the command exits with exit code 3 and an error message identifying the unknown key

### Requirement: Project Listing
The system SHALL provide `orc list` to display all registered projects with their keys and paths.

#### Scenario: List with registered projects shows key-path pairs
- **WHEN** `orc list` is invoked and `projects.toml` contains one or more entries
- **THEN** each registered project is printed with its key and resolved path, one entry per line

#### Scenario: List with no projects shows helpful message
- **WHEN** `orc list` is invoked and `projects.toml` contains no entries
- **THEN** a helpful message is printed explaining that no projects are registered and how to add one

### Requirement: Configuration Editing
The system SHALL provide `orc config` to open `config.local.toml` in `$EDITOR`, and `orc config <project>` to open the project's `.orc/config.toml` in `$EDITOR`, creating the file if it does not yet exist.

#### Scenario: No args opens local config
- **WHEN** `orc config` is invoked without arguments
- **THEN** `$EDITOR` is launched with `config.local.toml` as the target file

#### Scenario: With project arg opens project config
- **WHEN** `orc config <project>` is invoked with a valid registered project key
- **THEN** `$EDITOR` is launched with `<project-path>/.orc/config.toml`, creating the file and any missing parent directories if needed

#### Scenario: Unknown project exits with error
- **WHEN** `orc config <project>` is invoked with a key that does not exist in `projects.toml`
- **THEN** the command exits with exit code 3 and an error message identifying the unknown project
