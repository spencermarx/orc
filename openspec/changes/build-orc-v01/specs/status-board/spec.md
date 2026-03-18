## ADDED Requirements

### Requirement: Status Dashboard
The system SHALL provide `orc status` to display a cross-project dashboard. It SHALL iterate all projects defined in `projects.toml`, scan each project's `.worktrees/` directory for `.worker-status` files, and display formatted output showing: project name, active bead IDs, worker status (working/review/blocked), and queued beads.

#### Scenario: status with active workers shows formatted dashboard
- **WHEN** `orc status` is run and at least one project has active workers
- **THEN** the output displays each project name alongside its active bead IDs, the worker status for each bead, and any queued beads in a formatted layout

#### Scenario: status with no projects shows empty state
- **WHEN** `orc status` is run and `projects.toml` contains no projects
- **THEN** the output displays an empty-state message indicating no projects are configured

#### Scenario: status shows blocked workers with reason
- **WHEN** `orc status` is run and a worker's `.worker-status` file contains a blocked status with a reason
- **THEN** the dashboard displays the blocked status and the associated reason for that bead

### Requirement: Dashboard Auto-Refresh
The system SHALL support auto-refreshing the dashboard via a dedicated tmux window named "dash" that runs `watch -n5 orc status`. The `orc start` root orchestrator flow SHALL create this "dash" window automatically as part of its startup sequence so the operator always has a live view without manual intervention.

#### Scenario: root orchestrator start creates dash window
- **WHEN** `orc start` is invoked
- **THEN** a tmux window named "dash" is created running `watch -n5 orc status`

#### Scenario: dash window refreshes every 5 seconds
- **WHEN** the "dash" tmux window is running
- **THEN** `orc status` is re-executed every 5 seconds via `watch -n5`, updating the displayed dashboard

### Requirement: Board View
The system SHALL provide `orc board <project>` to open a bead management view for the specified project in a tmux window named "{project}/board". When the project's `[board] command` configuration is empty or unset, the system SHALL use the built-in fallback: `watch -n5 bd list` run in the project's root directory. When a board command is configured, the system SHALL launch that command instead of the fallback.

#### Scenario: board with no configured tool uses built-in fallback
- **WHEN** `orc board <project>` is run and the project has no `[board] command` configured
- **THEN** a tmux window named "{project}/board" is created running `watch -n5 bd list` in the project directory

#### Scenario: board with configured tool launches that tool
- **WHEN** `orc board <project>` is run and the project has a `[board] command` configured and that command is found on PATH
- **THEN** a tmux window named "{project}/board" is created running the configured board command

#### Scenario: board with configured tool not on PATH warns and falls back
- **WHEN** `orc board <project>` is run and the project has a `[board] command` configured but that command is not found on PATH
- **THEN** the system prints a warning identifying the missing tool and falls back to the built-in `watch -n5 bd list` view

### Requirement: Board Tool Fallback
When the configured `[board] command` is not found on PATH, the system SHALL print a warning message that explicitly identifies the name of the missing tool and then fall back to launching the built-in `watch -n5 bd list` view in the project directory.

#### Scenario: configured tool missing prints warning with tool name
- **WHEN** the board command resolved from `[board] command` is not available on PATH
- **THEN** the system prints a warning message containing the name of the missing tool before proceeding to fallback

#### Scenario: fallback launches watch bd list
- **WHEN** the board tool fallback is triggered due to a missing configured command
- **THEN** the system launches `watch -n5 bd list` in the project directory within the "{project}/board" tmux window
