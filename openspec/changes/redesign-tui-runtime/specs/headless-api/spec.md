## ADDED Requirements

### Requirement: REST API for Orchestration Control

The system SHALL expose a REST API on the orc daemon for programmatic orchestration control. The API SHALL be started via `orc api` or automatically when `[api] enabled = true`.

Endpoints SHALL include:
- `GET /projects` — list registered projects
- `GET /projects/:id/goals` — list goals for a project
- `POST /projects/:id/goals` — create a new goal
- `GET /goals/:id/beads` — list beads for a goal
- `GET /beads/:id` — get bead status, feedback, cost
- `POST /beads/:id/dispatch` — dispatch a bead
- `POST /beads/:id/halt` — halt a bead's engineer
- `GET /session` — session metadata (uptime, agent count, cost)
- `GET /session/telemetry` — cost and timing data
- `GET /recordings` — list recordings
- `GET /recordings/:id/events` — event log for a recording

All endpoints SHALL require token-based authentication.

#### Scenario: CI/CD pipeline creates and monitors a goal
- **WHEN** a CI/CD pipeline sends `POST /projects/myapp/goals` with a goal description
- **THEN** the goal is created and the goal orchestrator is spawned
- **AND** the pipeline polls `GET /goals/:id/beads` to monitor progress
- **AND** when all beads are complete, the pipeline triggers delivery via `POST /goals/:id/deliver`

#### Scenario: API authentication required
- **WHEN** a request is made without a valid authentication token
- **THEN** the API returns HTTP 401 Unauthorized
- **AND** no state is read or modified

### Requirement: WebSocket API for Real-Time Streams

The system SHALL expose WebSocket endpoints for real-time data:
- `/ws/state` — live orchestration state stream (delta updates)
- `/ws/agents/:id/output` — live PTY output stream for a specific agent
- `/ws/events` — EventBus stream (all events)

#### Scenario: External dashboard consumes state stream
- **WHEN** an external application connects to `/ws/state`
- **THEN** it receives the current state snapshot
- **AND** subsequent state changes are pushed as delta updates
- **AND** the external application can render a custom dashboard from this data

### Requirement: Auto-Generated OpenAPI Specification

The system SHALL auto-generate an OpenAPI 3.0 specification from the REST route schemas. The spec SHALL be available at `GET /openapi.json` and rendered as interactive documentation at `GET /docs`.

#### Scenario: Developer explores API documentation
- **WHEN** a developer navigates to `http://localhost:PORT/docs`
- **THEN** they see interactive API documentation with all endpoints, schemas, and examples
- **AND** they can make test requests directly from the documentation UI
