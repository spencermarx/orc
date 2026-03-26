## ADDED Requirements

### Requirement: Token and Cost Tracking

The system SHALL track token usage (input and output tokens) and compute dollar cost for every agent interaction. Tracking SHALL be granular to: per-API-call, per-agent, per-bead, per-goal, per-project, and per-session.

Cost calculation SHALL use a configurable model pricing table. Default pricing SHALL be included for common models (Claude Opus, Sonnet, Haiku; GPT-4o, o1; etc.) and users SHALL be able to override pricing via config.

#### Scenario: Per-bead cost visible in UI
- **WHEN** an engineer completes work on bead bd-a1b2
- **THEN** the bead's cost is displayed in the pane footer (e.g., "$3.19")
- **AND** the goal's total cost updates in real-time
- **AND** the session's total cost updates in the status bar

#### Scenario: Custom model pricing
- **WHEN** the user configures custom pricing in `[observability.pricing]`
- **THEN** cost calculations use the custom rates
- **AND** the default pricing table is overridden for the specified models

### Requirement: Cost Budgets and Alerts

The system SHALL support cost budgets at session, project, and goal levels. When a budget threshold is reached, the system SHALL emit a notification. At 100% of budget, the system SHALL optionally pause agent work.

#### Scenario: Budget warning at 80%
- **WHEN** a session budget of $50.00 is configured
- **AND** cumulative session cost reaches $40.00 (80%)
- **THEN** a warning notification is emitted: "Session cost at 80% of $50.00 budget"
- **AND** the cost bar in the observability view turns yellow

#### Scenario: Budget exceeded pauses agents
- **WHEN** `[observability] pause_on_budget_exceeded = true`
- **AND** the session cost exceeds the configured budget
- **THEN** all agent processes are paused (SIGSTOP)
- **AND** the user is notified with an action button: [Resume] [Increase Budget] [Halt All]

### Requirement: Timing and Throughput Metrics

The system SHALL track wall-clock time per bead (with breakdown: working, review, waiting) and compute throughput metrics (beads/hour, lines changed/hour).

#### Scenario: Bead timing breakdown
- **WHEN** bead bd-a1b2 completes
- **THEN** the telemetry record shows: total=45m, working=30m, review=10m, waiting=5m
- **AND** this breakdown is visible in the observability view

### Requirement: Observability View

The system SHALL provide a dedicated Observability View accessible via keyboard shortcut (Ctrl+O) or command palette. The view SHALL display:
- Session cost bar (current vs budget)
- Cost breakdown by goal (bar chart)
- Cost breakdown by agent (table)
- Token throughput timeline (sparkline over time)
- Current cost rate ($/hour)
- Bead timing breakdown (stacked bar per bead)

#### Scenario: Observability view displays live data
- **WHEN** the user navigates to the Observability View
- **THEN** all charts and metrics display current data
- **AND** data updates in real-time as agents work
- **AND** the user can drill into any goal or agent for detailed breakdown
