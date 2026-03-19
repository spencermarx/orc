## ADDED Requirements

### Requirement: Project Registration
`orc add <key> <path>` SHALL validate the path exists, resolve it to absolute, reject reserved subcommand names as keys, check for duplicates, append to `projects.toml`, and install slash commands into the project's agent config directory.

#### Scenario: Project registered successfully
- **WHEN** `orc add myapp /path/to/myapp` is run with a valid, unique, non-reserved key
- **THEN** the project is appended to `projects.toml` and slash commands are symlinked into the project

#### Scenario: Duplicate key rejected
- **WHEN** `orc add myapp /path` is run and `myapp` already exists in `projects.toml`
- **THEN** the command fails with an error

### Requirement: Project Removal
`orc remove <key>` SHALL remove the project entry from `projects.toml`.

#### Scenario: Project removed
- **WHEN** `orc remove myapp` is run
- **THEN** the myapp entry is removed from `projects.toml`

### Requirement: Project Listing
`orc list` SHALL display all registered projects with their keys, paths, and active worker counts.

#### Scenario: List shows projects with worker counts
- **WHEN** `orc list` is run with two registered projects
- **THEN** each project is shown with its key, path, and number of active workers

### Requirement: Configuration Resolution
Config values SHALL resolve in three-layer order: `{project}/.orc/config.toml` > `config.local.toml` > `config.toml` (committed defaults). The most specific value wins.

#### Scenario: Project config overrides global
- **WHEN** `max_workers = 2` in `myapp/.orc/config.toml` and `max_workers = 3` in `config.toml`
- **THEN** `max_workers` resolves to 2 for myapp

### Requirement: First-Time Setup
`orc init` SHALL display ASCII art from `assets/orc-ascii.txt`, create the `orc` symlink in PATH, create `config.local.toml` and `projects.toml` if missing, install slash commands into the orc repo, and verify prerequisites (git, tmux, bd, agent CLI) with clear pass/fail output.

#### Scenario: Init displays ASCII art and sets up
- **WHEN** `orc init` is run for the first time
- **THEN** the orc ASCII art is displayed, config files are created, prerequisites are checked, and next steps are shown
