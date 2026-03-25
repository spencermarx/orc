## MODIFIED Requirements

### Requirement: Project Config Setup Command

The system SHALL provide an `orc setup <project>` CLI command that launches the project orchestrator in setup mode — an interactive, agent-driven experience for assembling a project's `.orc/config.toml` tailored to the project's tools, workflows, and the user's SDLC preferences.

The command SHALL:
- Launch the project orchestrator with a setup-mode briefing
- Be available for any registered project (`orc add` must have been run first)
- Work for both new projects (no `.orc/config.toml` yet) and existing projects (reconfigure)
- Produce a `.orc/config.toml` that the user reviews and approves before it's written

#### Scenario: First-time project setup
- **WHEN** the user runs `orc setup myapp`
- **AND** `myapp` has no `.orc/config.toml`
- **THEN** the project orchestrator launches in setup mode
- **AND** investigates the project, converses with the user, and produces a tailored config

#### Scenario: Reconfigure existing project
- **WHEN** the user runs `orc setup myapp`
- **AND** `myapp` already has `.orc/config.toml`
- **THEN** the project orchestrator launches in setup mode with the existing config as a starting point
- **AND** presents the current config, asks what the user wants to change, and produces an updated config

#### Scenario: Setup prompted after project registration (accept)
- **WHEN** the user runs `orc add myapp /path/to/myapp`
- **THEN** the CLI registers the project
- **AND** prompts: `"Run guided config setup now? [Y/n]"`
- **AND** on accept (or Enter with no input), launches `orc setup myapp`

#### Scenario: Setup prompted after project registration (decline)
- **WHEN** the user runs `orc add myapp /path/to/myapp`
- **THEN** the CLI registers the project
- **AND** prompts: `"Run guided config setup now? [Y/n]"`
- **AND** on decline (`n` or `N`), prints a note that setup can be run later with `orc setup myapp`
- **AND** does NOT launch the setup agent session

#### Scenario: Setup auto-launches in yolo mode
- **WHEN** the user runs `orc add myapp /path/to/myapp` with `--yolo` or `ORC_YOLO=1`
- **THEN** the CLI registers the project
- **AND** skips the prompt and launches `orc setup myapp` automatically
